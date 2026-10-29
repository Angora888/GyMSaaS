using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSaaS.Api.Members;
public sealed record PlanInput([property:Required,MinLength(2),MaxLength(100)] string Name, decimal Price, int DurationDays, string Currency);
public sealed record AssignMembershipInput(Guid MemberId,Guid PlanId,DateOnly StartDate);

public static class MembershipEndpoints {
 public static IEndpointRouteBuilder MapMembershipEndpoints(this IEndpointRouteBuilder app) {
  var routes=app.MapGroup("/api/admin").RequireAuthorization(p=>p.RequireRole("Owner"));
  routes.MapGet("/plans",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Gym(principal,out var gymId))return Results.Unauthorized();
   return Results.Ok(await db.Plans.AsNoTracking().Where(x=>x.GymId==gymId).OrderBy(x=>x.Name)
    .Select(x=>new{x.Id,x.Name,x.Price,x.Currency,x.DurationDays}).ToListAsync());
  });
  routes.MapPost("/plans",async(ClaimsPrincipal principal,GymDbContext db,PlanInput input)=>{
   if(!Gym(principal,out var gymId))return Results.Unauthorized();
   if(string.IsNullOrWhiteSpace(input.Name)||input.Name.Trim().Length<2||input.Name.Length>100||input.Price<0||input.DurationDays<1||input.DurationDays>3660||!new[]{"CRC","USD"}.Contains(input.Currency))
    return Results.BadRequest(new{message="Revisá nombre, precio, duración y moneda (CRC/USD)."});
   var plan=new MembershipPlan{GymId=gymId,Name=input.Name.Trim(),Price=input.Price,DurationDays=input.DurationDays,Currency=input.Currency};
   db.Plans.Add(plan);await db.SaveChangesAsync();
   return Results.Created($"/api/admin/plans/{plan.Id}",new{plan.Id,plan.Name,plan.Price,plan.DurationDays,plan.Currency});
  });
  routes.MapGet("/subscriptions",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Gym(principal,out var gymId))return Results.Unauthorized();
   var data=await (from s in db.Subscriptions.AsNoTracking()
    join p in db.Plans.AsNoTracking() on new{s.GymId,Id=s.PlanId} equals new{p.GymId,p.Id}
    join m in db.Members.AsNoTracking() on new{s.GymId,Id=s.MemberId} equals new{m.GymId,m.Id}
    where s.GymId==gymId orderby s.EndDate descending
    select new{s.Id,s.MemberId,memberName=m.FullName,s.PlanId,planName=p.Name,s.StartDate,s.EndDate}).Take(500).ToListAsync();
   return Results.Ok(data);
  });
  routes.MapPost("/subscriptions",async(ClaimsPrincipal principal,GymDbContext db,AssignMembershipInput input)=>{
   if(!Gym(principal,out var gymId))return Results.Unauthorized();
   var member=await db.Members.AsNoTracking().AnyAsync(x=>x.GymId==gymId&&x.Id==input.MemberId);
   var plan=await db.Plans.AsNoTracking().SingleOrDefaultAsync(x=>x.GymId==gymId&&x.Id==input.PlanId);
   if(!member||plan==null)return Results.BadRequest(new{message="Miembro o plan no pertenece al gimnasio."});
   if(input.StartDate<new DateOnly(2020,1,1)||input.StartDate>new DateOnly(2100,12,31))return Results.BadRequest(new{message="Fecha inválida."});
   var end=input.StartDate.AddDays(plan.DurationDays-1);
   if(await db.Subscriptions.AnyAsync(x=>x.GymId==gymId&&x.MemberId==input.MemberId&&x.StartDate<=end&&x.EndDate>=input.StartDate))
    return Results.Conflict(new{message="Ya existe una membresía que se cruza con estas fechas."});
   var sub=new MemberSubscription{GymId=gymId,MemberId=input.MemberId,PlanId=input.PlanId,StartDate=input.StartDate,EndDate=end};
   db.Subscriptions.Add(sub);await db.SaveChangesAsync();
   return Results.Created($"/api/admin/subscriptions/{sub.Id}",new{sub.Id,sub.MemberId,sub.PlanId,sub.StartDate,sub.EndDate});
  });
  return app;
 }
 static bool Gym(ClaimsPrincipal principal,out Guid gymId)=>Guid.TryParse(principal.FindFirst("gym_id")?.Value,out gymId);
}
