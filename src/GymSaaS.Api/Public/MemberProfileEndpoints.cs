using System.Security.Claims;
using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Public;
public sealed record MemberProfileUpdate(string? Phone,string? EmergencyPhone,decimal? WeightKg,decimal? HeightCm);
public static class MemberProfileEndpoints{
 public static IEndpointRouteBuilder MapMemberProfile(this IEndpointRouteBuilder app){
  app.MapPut("/api/member/profile",async(MemberProfileUpdate input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId)||!Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   if(input.Phone?.Length>40||input.EmergencyPhone?.Length>40||input.WeightKg is < 10 or > 500||input.HeightCm is < 50 or > 260)
    return Results.BadRequest(new{message="Verificá los teléfonos, peso (10 a 500 kg) y estatura (50 a 260 cm)."});
   var member=await db.Members.SingleOrDefaultAsync(x=>x.GymId==gymId&&x.Id==memberId);
   if(member is null)return Results.NotFound();
   member.Phone=string.IsNullOrWhiteSpace(input.Phone)?null:input.Phone.Trim();
   member.EmergencyPhone=string.IsNullOrWhiteSpace(input.EmergencyPhone)?null:input.EmergencyPhone.Trim();
   member.WeightKg=input.WeightKg;member.HeightCm=input.HeightCm;
   await db.SaveChangesAsync();
   return Results.Ok(new{member.Phone,member.EmergencyPhone,member.WeightKg,member.HeightCm});
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  return app;
 }
}
