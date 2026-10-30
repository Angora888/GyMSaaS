using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using GymSaaS.Api.Public;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record CatalogEntry(string Category,string Name,int DefaultSets=4,int DefaultReps=10,int DefaultRestSeconds=120,string? Notes=null);
public sealed record CatalogImport(List<CatalogEntry> Exercises);
public static class ExerciseCatalogEndpoints {
 public static IEndpointRouteBuilder MapExerciseCatalog(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/exercise-catalog").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   return Results.Ok(await db.ExerciseCatalogItems.AsNoTracking().Where(x=>x.GymId==gym).OrderBy(x=>x.Category).ThenBy(x=>x.Name).Select(x=>new{x.Id,x.Category,x.Name,x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes}).ToListAsync());
  });
  app.MapGet("/api/member/exercise-catalog",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId)||!Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   if(!await db.Members.AnyAsync(m=>m.Id==memberId&&m.GymId==gymId))return Results.Unauthorized();
   return Results.Ok(await db.ExerciseCatalogItems.AsNoTracking().Where(x=>x.GymId==gymId)
    .OrderBy(x=>x.Category).ThenBy(x=>x.Name)
    .Select(x=>new{x.Id,x.Category,x.Name,x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes}).ToListAsync());
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  group.MapPost("/import",async(CatalogImport input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(input.Exercises is null||input.Exercises.Count is <1 or >500)return Results.BadRequest(new{message="El catálogo debe contener entre 1 y 500 ejercicios."});
   var items=input.Exercises.Select(x=>new CatalogEntry(x.Category?.Trim()??"",x.Name?.Trim()??"",x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes?.Trim())).ToList();
   if(items.Any(x=>x.Category.Length is <2 or >80||x.Name.Length is <2 or >120||x.DefaultSets is <1 or >20||x.DefaultReps is <1 or >1000||x.DefaultRestSeconds is <0 or >3600||x.Notes?.Length>500))
    return Results.BadRequest(new{message="Revisá categorías, nombres, series, repeticiones y descansos."});
   var duplicates=items.GroupBy(x=>x.Category.ToLowerInvariant()+"|"+x.Name.ToLowerInvariant()).Any(g=>g.Count()>1);
   if(duplicates)return Results.BadRequest(new{message="El archivo tiene ejercicios duplicados en una categoría."});
   var existing=await db.ExerciseCatalogItems.Where(x=>x.GymId==gym).ToListAsync();
   var byKey=existing.ToDictionary(x=>x.Category.ToLowerInvariant()+"|"+x.Name.ToLowerInvariant());
   int added=0,updated=0;
   foreach(var e in items){
    var key=e.Category.ToLowerInvariant()+"|"+e.Name.ToLowerInvariant();
    if(!byKey.TryGetValue(key,out var row)){row=new ExerciseCatalogItem{GymId=gym,Category=e.Category,Name=e.Name};db.ExerciseCatalogItems.Add(row);byKey[key]=row;added++;}else updated++;
    row.DefaultSets=e.DefaultSets;row.DefaultReps=e.DefaultReps;row.DefaultRestSeconds=e.DefaultRestSeconds;row.Notes=e.Notes;
   }
   await db.SaveChangesAsync();
   return Results.Ok(new{added,updated,total=byKey.Count});
  });
  group.MapPost("/members/{memberId:guid}/assign",async(Guid memberId,WorkoutProgramInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(!await db.Members.AnyAsync(m=>m.GymId==gym&&m.Id==memberId))return Results.NotFound();
   if(!MemberWorkoutEndpoints.Valid(input))return Results.BadRequest(new{message="La rutina contiene ejercicios, días o series inválidos."});
   if(input.IsActive){var prior=await db.MemberWorkoutPrograms.Where(x=>x.GymId==gym&&x.MemberId==memberId&&x.IsActive).ToListAsync();foreach(var p in prior)p.IsActive=false;}
   var entity=new MemberWorkoutProgram{GymId=gym,MemberId=memberId,Name=input.Name.Trim(),Description=input.Description?.Trim(),IsActive=input.IsActive,DaysJson=System.Text.Json.JsonSerializer.Serialize(input.Days)};
   db.MemberWorkoutPrograms.Add(entity);await db.SaveChangesAsync();
   return Results.Ok(new{entity.Id,entity.Name});
  });
  return app;
 }
}
