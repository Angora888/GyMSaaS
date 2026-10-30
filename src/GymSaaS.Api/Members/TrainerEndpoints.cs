using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record TrainerInput(string Name);
public sealed record TrainerAssignment(Guid MemberId);
public static class TrainerEndpoints {
 public static IEndpointRouteBuilder MapTrainerEndpoints(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/trainers").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("",async(ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var trainers=await db.Trainers.AsNoTracking().Where(t=>t.GymId==gymId).OrderBy(t=>t.Name).Select(t=>new{t.Id,t.Name}).ToListAsync();
   var assignments=await db.TrainerMembers.AsNoTracking().Where(x=>x.GymId==gymId)
    .Join(db.Members.AsNoTracking(),x=>new{x.GymId,Id=x.MemberId},m=>new{m.GymId,m.Id},(x,m)=>new{x.TrainerId,x.MemberId,memberName=m.FullName}).ToListAsync();
   return Results.Ok(new{trainers,assignments});
  });
  group.MapPost("",async(TrainerInput input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var name=input.Name?.Trim();
   if(string.IsNullOrWhiteSpace(name)||name.Length<2||name.Length>120)return Results.BadRequest(new{message="Ingresá un nombre válido (2 a 120 caracteres)."});
   var trainer=new Trainer{GymId=gymId,Name=name};db.Trainers.Add(trainer);await db.SaveChangesAsync();
   return Results.Created($"/api/admin/trainers/{trainer.Id}",new{trainer.Id,trainer.Name});
  });
  group.MapPost("/{trainerId:guid}/members",async(Guid trainerId,TrainerAssignment input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   if(!await db.Trainers.AnyAsync(t=>t.Id==trainerId&&t.GymId==gymId)||!await db.Members.AnyAsync(m=>m.Id==input.MemberId&&m.GymId==gymId))
    return Results.NotFound();
   if(await db.TrainerMembers.AnyAsync(x=>x.GymId==gymId&&x.TrainerId==trainerId&&x.MemberId==input.MemberId))
    return Results.Conflict(new{message="Este miembro ya está asignado al entrenador."});
   db.TrainerMembers.Add(new TrainerMember{GymId=gymId,TrainerId=trainerId,MemberId=input.MemberId});
   try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="Esta asignación ya existe."});}
   return Results.Ok(new{assigned=true});
  });
  group.MapDelete("/{trainerId:guid}/members/{memberId:guid}",async(Guid trainerId,Guid memberId,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var assigned=await db.TrainerMembers.SingleOrDefaultAsync(x=>x.GymId==gymId&&x.TrainerId==trainerId&&x.MemberId==memberId);
   if(assigned is null)return Results.NotFound();
   db.TrainerMembers.Remove(assigned);await db.SaveChangesAsync();
   return Results.NoContent();
  });
  return app;
 }
}
