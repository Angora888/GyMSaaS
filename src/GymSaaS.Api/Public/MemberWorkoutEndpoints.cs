using System.Security.Claims;
using System.Text.Json;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Public;
public sealed record WorkoutExercise(string Id,string Name,int Sets,int Reps,int RestSeconds);
public sealed record WorkoutDay(string Id,string Name,int[] Weekdays,List<WorkoutExercise> Exercises);
public sealed record WorkoutProgramInput(string Name,string? Description,bool IsActive,List<WorkoutDay> Days);
public sealed record WorkoutProgressInput(string ExerciseId,int SetNumber,bool Completed,decimal? WeightKg);
public static class MemberWorkoutEndpoints {
 static bool Tenant(ClaimsPrincipal p,out Guid gym,out Guid member)=>Guid.TryParse(p.FindFirst("gym_id")?.Value,out gym)&Guid.TryParse(p.FindFirst("member_id")?.Value,out member);
 static bool Valid(WorkoutProgramInput input)=>!string.IsNullOrWhiteSpace(input.Name)&&input.Name.Trim().Length<=120&&input.Description?.Length<=1000&&input.Days is {Count:>0 and <=14}&&
 input.Days.All(d=>!string.IsNullOrWhiteSpace(d.Id)&&d.Id.Length<=80&&!string.IsNullOrWhiteSpace(d.Name)&&d.Name.Length<=80&&d.Weekdays is not null&&d.Weekdays.All(w=>w>=0&&w<=6)&&d.Exercises is {Count:>0 and <=30}&&
 d.Exercises.All(e=>!string.IsNullOrWhiteSpace(e.Id)&&e.Id.Length<=80&&!string.IsNullOrWhiteSpace(e.Name)&&e.Name.Length<=120&&e.Sets is >=1 and <=20&&e.Reps is >=1 and <=1000&&e.RestSeconds is >=0 and <=3600))&&
 input.Days.Select(d=>d.Id).Distinct().Count()==input.Days.Count&&input.Days.SelectMany(d=>d.Exercises.Select(e=>e.Id)).Distinct().Count()==input.Days.Sum(d=>d.Exercises.Count);
 public static IEndpointRouteBuilder MapMemberWorkouts(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/member/workouts").RequireAuthorization(p=>p.RequireRole("Member"));
  group.MapGet("",async(ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   var programs=await db.MemberWorkoutPrograms.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==member).OrderByDescending(x=>x.CreatedAt).ToListAsync();
   var sessions=await db.MemberWorkoutSessions.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==member).OrderByDescending(x=>x.StartedAt).Take(40).ToListAsync();
   return Results.Ok(new{programs=programs.Select(p=>new{p.Id,p.Name,p.Description,p.IsActive,p.CreatedAt,days=JsonSerializer.Deserialize<List<WorkoutDay>>(p.DaysJson)}),sessions=sessions.Select(s=>new{s.Id,s.ProgramId,s.DayId,s.StartedAt,s.FinishedAt,completed=JsonSerializer.Deserialize<List<string>>(s.CompletedJson),weights=JsonSerializer.Deserialize<Dictionary<string,decimal>>(s.WeightsJson)})});
  });
  group.MapPost("",async(WorkoutProgramInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   if(!Valid(input))return Results.BadRequest(new{message="Revisá los días, ejercicios, series, repeticiones y descansos."});
   if(input.IsActive){var old=await db.MemberWorkoutPrograms.Where(p=>p.GymId==gym&&p.MemberId==member&&p.IsActive).ToListAsync();foreach(var p in old)p.IsActive=false;}
   var entity=new MemberWorkoutProgram{GymId=gym,MemberId=member,Name=input.Name.Trim(),Description=input.Description?.Trim(),IsActive=input.IsActive,DaysJson=JsonSerializer.Serialize(input.Days)};
   db.MemberWorkoutPrograms.Add(entity);await db.SaveChangesAsync();return Results.Ok(new{entity.Id});
  });
  group.MapPut("/{programId:guid}",async(Guid programId,WorkoutProgramInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   if(!Valid(input))return Results.BadRequest(new{message="Revisá los días, ejercicios, series, repeticiones y descansos."});
   var entity=await db.MemberWorkoutPrograms.SingleOrDefaultAsync(p=>p.Id==programId&&p.GymId==gym&&p.MemberId==member);
   if(entity is null)return Results.NotFound();
   if(await db.MemberWorkoutSessions.AnyAsync(s=>s.ProgramId==programId&&s.GymId==gym&&s.MemberId==member&&s.FinishedAt==null))
    return Results.Conflict(new{message="Terminá el entrenamiento que está en curso antes de editar esta rutina."});
   if(input.IsActive){
    var old=await db.MemberWorkoutPrograms.Where(p=>p.GymId==gym&&p.MemberId==member&&p.Id!=programId&&p.IsActive).ToListAsync();
    foreach(var p in old)p.IsActive=false;
   }
   entity.Name=input.Name.Trim();
   entity.Description=input.Description?.Trim();
   entity.IsActive=input.IsActive;
   entity.DaysJson=JsonSerializer.Serialize(input.Days);
   await db.SaveChangesAsync();
   return Results.Ok(new{entity.Id,entity.Name,entity.IsActive});
  });
  group.MapPost("/{programId:guid}/days/{dayId}/start",async(Guid programId,string dayId,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   var program=await db.MemberWorkoutPrograms.AsNoTracking().FirstOrDefaultAsync(p=>p.Id==programId&&p.GymId==gym&&p.MemberId==member);
   if(program is null)return Results.NotFound();
   var days=JsonSerializer.Deserialize<List<WorkoutDay>>(program.DaysJson)??[];
   if(!days.Any(d=>d.Id==dayId))return Results.NotFound();
   var session=await db.MemberWorkoutSessions.Where(s=>s.GymId==gym&&s.MemberId==member&&s.ProgramId==programId&&s.DayId==dayId&&s.FinishedAt==null).OrderByDescending(s=>s.StartedAt).FirstOrDefaultAsync();
   if(session is null){session=new MemberWorkoutSession{GymId=gym,MemberId=member,ProgramId=programId,DayId=dayId};db.MemberWorkoutSessions.Add(session);await db.SaveChangesAsync();}
   return Results.Ok(new{session.Id,session.DayId,session.StartedAt,completed=JsonSerializer.Deserialize<List<string>>(session.CompletedJson),weights=JsonSerializer.Deserialize<Dictionary<string,decimal>>(session.WeightsJson)});
  });
  group.MapPut("/sessions/{sessionId:guid}/progress",async(Guid sessionId,WorkoutProgressInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   var session=await db.MemberWorkoutSessions.SingleOrDefaultAsync(x=>x.Id==sessionId&&x.GymId==gym&&x.MemberId==member);
   if(session is null)return Results.NotFound();
   if(session.FinishedAt!=null)return Results.Conflict(new{message="Este entrenamiento ya terminó."});
   var program=await db.MemberWorkoutPrograms.AsNoTracking().SingleAsync(p=>p.Id==session.ProgramId&&p.GymId==gym&&p.MemberId==member);
   var day=(JsonSerializer.Deserialize<List<WorkoutDay>>(program.DaysJson)??[]).FirstOrDefault(d=>d.Id==session.DayId);
   var exercise=day?.Exercises.FirstOrDefault(e=>e.Id==input.ExerciseId);
   if(exercise is null||input.SetNumber<1||input.SetNumber>exercise.Sets||input.WeightKg is < 0 or > 2000)return Results.BadRequest(new{message="Serie inválida."});
   var list=(JsonSerializer.Deserialize<List<string>>(session.CompletedJson)??[]).ToHashSet();
   var key=input.ExerciseId+":"+input.SetNumber;
   if(input.Completed)list.Add(key);else list.Remove(key);
   var weights=JsonSerializer.Deserialize<Dictionary<string,decimal>>(session.WeightsJson)??new();
   if(input.WeightKg.HasValue)weights[key]=input.WeightKg.Value;
   session.WeightsJson=JsonSerializer.Serialize(weights);
   session.CompletedJson=JsonSerializer.Serialize(list.OrderBy(x=>x));await db.SaveChangesAsync();
   return Results.Ok(new{completed=list,weights});
  });
  group.MapPost("/sessions/{sessionId:guid}/finish",async(Guid sessionId,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Tenant(user,out var gym,out var member))return Results.Unauthorized();
   var session=await db.MemberWorkoutSessions.SingleOrDefaultAsync(x=>x.Id==sessionId&&x.GymId==gym&&x.MemberId==member);
   if(session is null)return Results.NotFound();
   if(session.FinishedAt==null){session.FinishedAt=DateTimeOffset.UtcNow;await db.SaveChangesAsync();}
   return Results.Ok(new{session.Id,session.FinishedAt,completed=JsonSerializer.Deserialize<List<string>>(session.CompletedJson)});
  });
  return app;
 }
}
