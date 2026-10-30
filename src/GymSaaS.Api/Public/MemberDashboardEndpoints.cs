using System.Security.Claims;
using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Public;
public static class MemberDashboardEndpoints {
 public static IEndpointRouteBuilder MapMemberDashboard(this IEndpointRouteBuilder app){
  app.MapGet("/api/member/dashboard",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId)||
      !Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   var member=await db.Members.AsNoTracking().Where(x=>x.GymId==gymId&&x.Id==memberId)
     .Select(x=>new{x.Id,x.FullName,x.Email,x.Phone,x.EmergencyPhone,x.WeightKg,x.HeightCm}).FirstOrDefaultAsync();
   if(member is null)return Results.Unauthorized();
   var gym=await db.Gyms.AsNoTracking().Where(x=>x.Id==gymId&&x.IsActive)
     .Select(x=>new{x.Name,x.Slug}).FirstOrDefaultAsync();
   if(gym is null)return Results.Unauthorized();
   var today=DateOnly.FromDateTime(DateTime.UtcNow);
   var subscription=await (from s in db.Subscriptions.AsNoTracking()
     join p in db.Plans.AsNoTracking() on new{s.GymId,Id=s.PlanId} equals new{p.GymId,p.Id}
     where s.GymId==gymId&&s.MemberId==memberId
     orderby s.EndDate descending
     select new {plan=p.Name,startDate=s.StartDate,endDate=s.EndDate,price=p.Price,currency=p.Currency})
     .FirstOrDefaultAsync();
   var start=DateTimeOffset.UtcNow.AddDays(-14);
   var attendance=await db.Attendances.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId&&x.CheckedInAt>=start)
     .OrderByDescending(x=>x.CheckedInAt).Select(x=>x.CheckedInAt).ToListAsync();
   var routine=await db.Routines.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId)
     .OrderBy(x=>x.Name).Select(x=>new{x.Id,x.Name,x.Description}).FirstOrDefaultAsync();
   var personalProgram=await db.MemberWorkoutPrograms.AsNoTracking().Where(x=>x.GymId==gymId&&x.MemberId==memberId&&x.IsActive).OrderByDescending(x=>x.CreatedAt).Select(x=>new{x.Id,x.Name,x.Description}).FirstOrDefaultAsync();
   return Results.Ok(new{
    member,gym,personalProgram,
    membership=subscription is null?null:new {subscription.plan,subscription.startDate,subscription.endDate,subscription.price,subscription.currency,
      status=subscription.startDate<=today&&subscription.endDate>=today?"active":subscription.endDate<today?"expired":"upcoming"},
    attendance=attendance.Select(x=>x.ToString("O")).ToArray(),routine
   });
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  return app;
 }
}
