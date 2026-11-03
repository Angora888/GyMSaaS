using System.Security.Claims;
using System.Text.Json;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using GymSaaS.Api.Public;
using Microsoft.EntityFrameworkCore;

namespace GymSaaS.Api.Members;
public sealed record TemplateAssignInput(Guid MemberId);
public static class WorkoutTemplateEndpoints {
 public static IEndpointRouteBuilder MapWorkoutTemplates(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/workout-templates").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("",async(ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var templates=await db.WorkoutTemplates.AsNoTracking().Where(t=>t.GymId==gym).OrderBy(t=>t.Name).ToListAsync();
   return Results.Ok(templates.Select(t=>new{t.Id,t.Name,t.Description,t.CreatedAt,days=JsonSerializer.Deserialize<List<WorkoutDay>>(t.DaysJson,new JsonSerializerOptions(JsonSerializerDefaults.Web))}));
  });
  group.MapPost("",async(WorkoutProgramInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(!MemberWorkoutEndpoints.Valid(input))return Results.BadRequest(new{message="Revisá los días, ejercicios y series de la plantilla."});
   if(await db.WorkoutTemplates.AnyAsync(t=>t.GymId==gym&&t.Name==input.Name.Trim()))return Results.Conflict(new{message="Ya existe una plantilla con ese nombre."});
   var row=new WorkoutTemplate{GymId=gym,Name=input.Name.Trim(),Description=input.Description?.Trim(),DaysJson=JsonSerializer.Serialize(input.Days)};
   db.WorkoutTemplates.Add(row);
   try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="Ya existe una plantilla con ese nombre."});}
   return Results.Ok(new{row.Id,row.Name});
  });
  group.MapPut("/{id:guid}",async(Guid id,WorkoutProgramInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(!MemberWorkoutEndpoints.Valid(input))return Results.BadRequest(new{message="La plantilla contiene datos inválidos."});
   var row=await db.WorkoutTemplates.SingleOrDefaultAsync(t=>t.GymId==gym&&t.Id==id);
   if(row is null)return Results.NotFound();
   row.Name=input.Name.Trim();row.Description=input.Description?.Trim();row.DaysJson=JsonSerializer.Serialize(input.Days);
   try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="Ya existe otra plantilla con ese nombre."});}
   return Results.Ok(new{row.Id,row.Name});
  });
  group.MapPost("/{id:guid}/assign",async(Guid id,TemplateAssignInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(!await db.Members.AnyAsync(m=>m.GymId==gym&&m.Id==input.MemberId))return Results.NotFound();
   var template=await db.WorkoutTemplates.AsNoTracking().SingleOrDefaultAsync(t=>t.GymId==gym&&t.Id==id);
   if(template is null)return Results.NotFound();
   var existing=await db.MemberWorkoutPrograms.AnyAsync(p=>p.GymId==gym&&p.MemberId==input.MemberId&&p.Name==template.Name);
   if(existing)return Results.Conflict(new{message="Este miembro ya tiene una rutina con ese nombre. Revisala antes de volver a asignarla."});
   // Independent copy: editing a template never changes an assigned routine or exercise IDs in progress.
   var days=JsonSerializer.Deserialize<List<WorkoutDay>>(template.DaysJson,new JsonSerializerOptions(JsonSerializerDefaults.Web));
   if(days is null||days.Count==0)return Results.BadRequest(new{message="La plantilla está vacía."});
   var copy=days.Select(d=>d with{Id=Guid.NewGuid().ToString(),Exercises=d.Exercises.Select(e=>e with{Id=Guid.NewGuid().ToString()}).ToList()}).ToList();
   var routine=new MemberWorkoutProgram{GymId=gym,MemberId=input.MemberId,Name=template.Name,Description=template.Description,IsActive=false,DaysJson=JsonSerializer.Serialize(copy)};
   db.MemberWorkoutPrograms.Add(routine);
   await db.SaveChangesAsync();
   return Results.Ok(new{routine.Id,routine.Name,message="Plantilla asignada al miembro. Se guardó como rutina independiente."});
  });
  return app;
 }
}
