using System.Security.Claims;
using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public static class MemberProfileEndpoints{
 public static IEndpointRouteBuilder MapMemberProfileAdmin(this IEndpointRouteBuilder app){
  app.MapGet("/api/admin/members/{memberId:guid}/profile",async(Guid memberId,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var member=await db.Members.AsNoTracking().Where(x=>x.GymId==gym&&x.Id==memberId).Select(x=>new{x.Id,x.FullName,x.Email,x.Phone,x.WeightKg,x.HeightCm}).SingleOrDefaultAsync();
   if(member is null)return Results.NotFound();
   var subscriptions=await (from s in db.Subscriptions.AsNoTracking() join p in db.Plans.AsNoTracking() on new{s.GymId,Id=s.PlanId} equals new{p.GymId,p.Id}
    where s.GymId==gym&&s.MemberId==memberId orderby s.EndDate descending
    select new{s.Id,plan=p.Name,p.Price,p.Currency,s.StartDate,s.EndDate}).ToListAsync();
   var payments=await db.MembershipPayments.AsNoTracking().Where(x=>x.GymId==gym&&subscriptions.Select(s=>s.Id).Contains(x.SubscriptionId)).OrderByDescending(x=>x.PaidAt)
    .Select(x=>new{x.Id,x.SubscriptionId,x.Amount,x.Currency,x.Method,x.PaidAt}).ToListAsync();
   var trainers=await (from tm in db.TrainerMembers.AsNoTracking() join t in db.Trainers.AsNoTracking() on tm.TrainerId equals t.Id
    where tm.GymId==gym&&tm.MemberId==memberId&&t.GymId==gym select new{t.Id,t.Name}).ToListAsync();
   var attendances=await db.Attendances.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==memberId).OrderByDescending(x=>x.CheckedInAt)
    .Take(30).Select(x=>x.CheckedInAt).ToListAsync();
   var workouts=await db.MemberWorkoutPrograms.AsNoTracking().Where(x=>x.GymId==gym&&x.MemberId==memberId).OrderByDescending(x=>x.CreatedAt)
    .Select(x=>new{x.Id,x.Name,x.IsActive,x.CreatedAt}).ToListAsync();
   return Results.Ok(new{member,subscriptions=subscriptions.Select(s=>new{s.Id,s.plan,s.Price,s.Currency,s.StartDate,s.EndDate,
    paid=payments.Where(p=>p.SubscriptionId==s.Id).Sum(p=>p.Amount),balance=Math.Max(0,s.Price-payments.Where(p=>p.SubscriptionId==s.Id).Sum(p=>p.Amount))}),
    payments,trainers,attendances,workouts});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));
  return app;
 }
}
