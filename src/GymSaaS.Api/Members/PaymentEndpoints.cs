using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record PaymentInput(Guid SubscriptionId, decimal Amount, string Method, string? Note);
public static class PaymentEndpoints {
 public static IEndpointRouteBuilder MapPayments(this IEndpointRouteBuilder app){
  var routes=app.MapGroup("/api/admin/billing").RequireAuthorization(p=>p.RequireRole("Owner"));
  routes.MapGet("",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var subs=await (from s in db.Subscriptions.AsNoTracking()
    join p in db.Plans.AsNoTracking() on new{s.GymId,Id=s.PlanId} equals new{p.GymId,p.Id}
    join m in db.Members.AsNoTracking() on new{s.GymId,Id=s.MemberId} equals new{m.GymId,m.Id}
    where s.GymId==gym select new{s.Id,s.MemberId,memberName=m.FullName,planName=p.Name,price=p.Price,currency=p.Currency,s.StartDate,s.EndDate}).ToListAsync();
   var payments=await db.MembershipPayments.AsNoTracking().Where(x=>x.GymId==gym).OrderByDescending(x=>x.PaidAt)
    .Select(x=>new{x.Id,x.SubscriptionId,x.Amount,x.Currency,x.Method,x.Note,x.PaidAt}).ToListAsync();
   var paid=payments.GroupBy(x=>x.SubscriptionId).ToDictionary(g=>g.Key,g=>g.Sum(x=>x.Amount));
   var subscriptions=subs.Select(s=>new{s.Id,s.memberName,s.planName,s.price,s.currency,s.StartDate,s.EndDate,paid=paid.GetValueOrDefault(s.Id),balance=Math.Max(0,s.price-paid.GetValueOrDefault(s.Id))});
   var tz=TimeZoneInfo.FindSystemTimeZoneById("America/Costa_Rica");
   var today=TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,tz);
   var monthTotals=payments.Where(x=>{var d=TimeZoneInfo.ConvertTime(x.PaidAt,tz);return d.Year==today.Year&&d.Month==today.Month;}).GroupBy(x=>x.Currency).Select(g=>new{currency=g.Key,total=g.Sum(x=>x.Amount)});
   return Results.Ok(new{subscriptions,payments,monthTotals});
  });
  routes.MapPost("/payments",async(PaymentInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var sub=await (from s in db.Subscriptions.AsNoTracking() join p in db.Plans.AsNoTracking()
    on new{s.GymId,Id=s.PlanId} equals new{p.GymId,p.Id} where s.GymId==gym&&s.Id==input.SubscriptionId select new{s.Id,p.Price,p.Currency}).SingleOrDefaultAsync();
   if(sub is null)return Results.NotFound();
   if(input.Amount<=0||input.Amount>100000000||input.Note?.Length>300||!new[]{"Efectivo","SINPE","Tarjeta","Transferencia","Otro"}.Contains(input.Method))
    return Results.BadRequest(new{message="Monto o método inválido."});
   var paid=await db.MembershipPayments.Where(x=>x.GymId==gym&&x.SubscriptionId==sub.Id).SumAsync(x=>(decimal?)x.Amount)??0;
   if(input.Amount>sub.Price-paid)return Results.BadRequest(new{message="El pago supera el saldo pendiente."});
   var payment=new MembershipPayment{GymId=gym,SubscriptionId=sub.Id,Amount=input.Amount,Currency=sub.Currency,Method=input.Method,Note=input.Note?.Trim()};
   db.MembershipPayments.Add(payment);await db.SaveChangesAsync();
   return Results.Ok(new{payment.Id,payment.Amount});
  });
  return app;
 }
}
