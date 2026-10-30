using System.Security.Claims;
using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public static class OwnerDashboardEndpoints {
 public static IEndpointRouteBuilder MapOwnerDashboard(this IEndpointRouteBuilder app){
  app.MapGet("/api/admin/overview",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var tz=TimeZoneInfo.FindSystemTimeZoneById("America/Costa_Rica");
   var localNow=TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,tz);
   var today=DateOnly.FromDateTime(localNow.Date);
   var dayStart=new DateTimeOffset(localNow.Date,tz.GetUtcOffset(localNow.Date)).ToUniversalTime();
   var dayEnd=dayStart.AddDays(1);
   var total=await db.Members.CountAsync(m=>m.GymId==gymId);
   var active=await db.Subscriptions.Where(s=>s.GymId==gymId&&s.StartDate<=today&&s.EndDate>=today).Select(s=>s.MemberId).Distinct().CountAsync();
   var expiring=await db.Subscriptions.Where(s=>s.GymId==gymId&&s.EndDate>=today&&s.EndDate<=today.AddDays(7)).Select(s=>s.MemberId).Distinct().CountAsync();
   var attendance=await db.Attendances.Where(a=>a.GymId==gymId&&a.CheckedInAt>=dayStart&&a.CheckedInAt<dayEnd).Select(a=>a.MemberId).Distinct().CountAsync();
   var monthStart=new DateTime(localNow.Year,localNow.Month,1);
   var monthStartUtc=new DateTimeOffset(monthStart,tz.GetUtcOffset(monthStart)).ToUniversalTime();
   var monthPayments=await db.MembershipPayments.AsNoTracking().Where(p=>p.GymId==gymId&&p.PaidAt>=monthStartUtc&&p.PaidAt<=DateTimeOffset.UtcNow)
    .GroupBy(p=>p.Currency).Select(g=>new{currency=g.Key,total=g.Sum(p=>p.Amount)}).ToListAsync();
   return Results.Ok(new{members=total,activeMemberships=active,expiringMemberships=expiring,attendanceToday=attendance,monthPayments,asOf=today});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));
  return app;
 }
}
