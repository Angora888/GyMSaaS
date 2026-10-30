using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using GymSaaS.Api.Auth;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using GymSaaS.Api.Public;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record TrainerAccountInput(string Email,string Password);
public static class TrainerPortalEndpoints{
 public static IEndpointRouteBuilder MapTrainerPortal(this IEndpointRouteBuilder app){
  app.MapPost("/api/admin/trainers/{trainerId:guid}/account",async(Guid trainerId,TrainerAccountInput input,ClaimsPrincipal principal,GymDbContext db,IPasswordHasher<AppUser> hasher)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var trainer=await db.Trainers.SingleOrDefaultAsync(x=>x.Id==trainerId&&x.GymId==gym);
   if(trainer==null)return Results.NotFound();
   var email=input.Email?.Trim().ToLowerInvariant();
   if(email==null||!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email)||input.Password==null||input.Password.Length<12)
    return Results.BadRequest(new{message="Ingresá correo válido y contraseña de al menos 12 caracteres."});
   if(await db.Users.AnyAsync(u=>u.Email==email))return Results.Conflict(new{message="El correo ya está registrado."});
   var user=new AppUser{GymId=gym,TrainerId=trainerId,Email=email,FullName=trainer.Name,PasswordHash="",Role="Trainer"};
   user.PasswordHash=hasher.HashPassword(user,input.Password);db.Users.Add(user);
   try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="El correo ya está registrado."});}
   return Results.Ok(new{user.Id,user.Email,trainer.Id,trainer.Name});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));
  var group=app.MapGroup("/api/trainer").RequireAuthorization(p=>p.RequireRole("Trainer"));
  group.MapGet("/overview",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym)||!Guid.TryParse(principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value,out var uid))return Results.Unauthorized();
   var account=await db.Users.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==uid&&x.GymId==gym&&x.Role=="Trainer");
   if(account?.TrainerId==null)return Results.Unauthorized();
   var members=await (from tm in db.TrainerMembers.AsNoTracking() join m in db.Members.AsNoTracking()
    on new{tm.GymId,Id=tm.MemberId} equals new{m.GymId,m.Id}
    where tm.GymId==gym&&tm.TrainerId==account.TrainerId select new{m.Id,m.FullName,m.Email}).ToListAsync();
   var catalog=await db.ExerciseCatalogItems.AsNoTracking().Where(x=>x.GymId==gym).OrderBy(x=>x.Category).ThenBy(x=>x.Name)
    .Select(x=>new{x.Id,x.Category,x.Name,x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds}).ToListAsync();
   return Results.Ok(new{trainer=account.FullName,members,catalog});
  });
  group.MapGet("/members/{memberId:guid}/progress",async(Guid memberId,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!await Allowed(principal,db,memberId))return Results.Forbid();
   var gym=Guid.Parse(principal.FindFirst("gym_id")!.Value);
   var member=await db.Members.AsNoTracking().Where(x=>x.GymId==gym&&x.Id==memberId).Select(x=>new{x.Id,x.FullName,x.WeightKg,x.HeightCm}).SingleAsync();
   var measurements=await db.MemberMeasurements.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==memberId).OrderByDescending(x=>x.RecordedAt)
    .Take(30).Select(x=>new{x.WeightKg,x.HeightCm,x.RecordedAt}).ToListAsync();
   var programs=await db.MemberWorkoutPrograms.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==memberId).OrderByDescending(x=>x.CreatedAt).Select(x=>new{x.Name,x.IsActive}).ToListAsync();
   return Results.Ok(new{member,measurements,programs});
  });
  group.MapPost("/members/{memberId:guid}/routines",async(Guid memberId,WorkoutProgramInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!await Allowed(principal,db,memberId))return Results.Forbid();
   if(!MemberWorkoutEndpoints.Valid(input))return Results.BadRequest(new{message="La rutina tiene datos inválidos."});
   var gym=Guid.Parse(principal.FindFirst("gym_id")!.Value);
   if(input.IsActive){var others=await db.MemberWorkoutPrograms.Where(x=>x.GymId==gym&&x.MemberId==memberId&&x.IsActive).ToListAsync();foreach(var p in others)p.IsActive=false;}
   var program=new MemberWorkoutProgram{GymId=gym,MemberId=memberId,Name=input.Name.Trim(),Description=input.Description?.Trim(),IsActive=input.IsActive,DaysJson=System.Text.Json.JsonSerializer.Serialize(input.Days)};
   db.MemberWorkoutPrograms.Add(program);await db.SaveChangesAsync();return Results.Ok(new{program.Id});
  });
  return app;
 }
 private static async Task<bool> Allowed(ClaimsPrincipal principal,GymDbContext db,Guid memberId){
  if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym)||!Guid.TryParse(principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value,out var uid))return false;
  var trainerId=await db.Users.AsNoTracking().Where(x=>x.Id==uid&&x.GymId==gym&&x.Role=="Trainer").Select(x=>x.TrainerId).SingleOrDefaultAsync();
  return trainerId.HasValue&&await db.TrainerMembers.AnyAsync(x=>x.GymId==gym&&x.TrainerId==trainerId.Value&&x.MemberId==memberId);
 }
}
