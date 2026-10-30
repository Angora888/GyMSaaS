using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record RoutineAssignment([property:Required,MinLength(2),MaxLength(120)] string Name,[property:MaxLength(3000)] string? Description);
public static class MemberCoachingEndpoints{
 public static IEndpointRouteBuilder MapMemberCoaching(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/members").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("/{memberId:guid}/progress",async(Guid memberId,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var member=await db.Members.AsNoTracking().Where(x=>x.GymId==gymId&&x.Id==memberId).Select(x=>new{x.Id,x.FullName,x.WeightKg,x.HeightCm,x.EmergencyPhone}).SingleOrDefaultAsync();
   if(member is null)return Results.NotFound();
   var history=await db.MemberMeasurements.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId).OrderByDescending(x=>x.RecordedAt).Take(120).Select(x=>new{x.Id,x.WeightKg,x.HeightCm,x.RecordedAt}).ToListAsync();
   var routines=await db.Routines.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId).OrderBy(x=>x.Name).Select(x=>new{x.Id,x.Name,x.Description}).ToListAsync();
   var programs=await db.MemberWorkoutPrograms.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId).OrderByDescending(x=>x.CreatedAt).Select(x=>new{x.Id,x.Name,x.Description,x.IsActive}).ToListAsync();
   return Results.Ok(new{member,measurements=history.OrderBy(x=>x.RecordedAt).Select(x=>new{x.Id,x.WeightKg,x.HeightCm,x.RecordedAt,Bmi=Math.Round(x.WeightKg/((x.HeightCm/100m)*(x.HeightCm/100m)),1)}),routines=programs});
  });
  group.MapPost("/{memberId:guid}/routines",async(Guid memberId,RoutineAssignment input,ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   if(string.IsNullOrWhiteSpace(input.Name)||input.Name.Trim().Length<2||input.Name.Length>120||input.Description?.Length>3000)return Results.BadRequest(new{message="Nombre o descripción inválidos."});
   if(!await db.Members.AnyAsync(x=>x.GymId==gymId&&x.Id==memberId))return Results.NotFound();
   var routine=new WorkoutRoutine{GymId=gymId,MemberId=memberId,Name=input.Name.Trim(),Description=input.Description?.Trim()};
   db.Routines.Add(routine);await db.SaveChangesAsync();
   return Results.Created($"/api/admin/members/{memberId}/progress",new{routine.Id,routine.Name,routine.Description});
  });
  return app;
 }
}
