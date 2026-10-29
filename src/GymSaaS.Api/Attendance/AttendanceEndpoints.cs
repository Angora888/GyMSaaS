using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSaaS.Api.Attendance;
public sealed record CheckinRequest(string Code);
public static class AttendanceEndpoints {
 const int SlotSeconds=30;
 static string Signature(Guid gymId,long slot,string secret){
  var bytes=HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret),Encoding.UTF8.GetBytes($"gymsaas-checkin-v1:{gymId:N}:{slot}"));
  return Convert.ToHexString(bytes.AsSpan(0,12)).ToLowerInvariant();
 }
 static string CreateCode(Guid gymId,long slot,string secret)=>$"{slot}.{Signature(gymId,slot,secret)}";
 static bool Validate(Guid gymId,string code,string secret){
  var parts=code.Split('.');
  if(parts.Length!=2||!long.TryParse(parts[0],out var slot)||parts[1].Length!=24)return false;
  var current=DateTimeOffset.UtcNow.ToUnixTimeSeconds()/SlotSeconds;
  if(slot<current-1||slot>current)return false;
  var expected=Encoding.ASCII.GetBytes(Signature(gymId,slot,secret));
  return CryptographicOperations.FixedTimeEquals(expected,Encoding.ASCII.GetBytes(parts[1]));
 }
 public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder app){
  app.MapGet("/api/admin/attendance/qr",async(ClaimsPrincipal principal,GymDbContext db,IConfiguration cfg)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var gym=await db.Gyms.AsNoTracking().Where(x=>x.Id==gymId&&x.IsActive).Select(x=>new{x.Slug,x.Name}).SingleOrDefaultAsync();
   if(gym is null)return Results.NotFound();
   var seconds=DateTimeOffset.UtcNow.ToUnixTimeSeconds();
   var slot=seconds/SlotSeconds;
   return Results.Ok(new{gym.Slug,gym.Name,code=CreateCode(gymId,slot,cfg["Jwt:Key"]!),expiresAt=DateTimeOffset.FromUnixTimeSeconds((slot+1)*SlotSeconds)});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));

  app.MapGet("/api/admin/attendance/today",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId))return Results.Unauthorized();
   var today=DateTimeOffset.UtcNow.Date;
   var entries=await db.Attendances.AsNoTracking().Where(a=>a.GymId==gymId&&a.CheckedInAt>=new DateTimeOffset(today,TimeSpan.Zero))
     .Join(db.Members.AsNoTracking(),a=>new{a.GymId,Id=a.MemberId},m=>new{m.GymId,m.Id},(a,m)=>new{m.FullName,a.CheckedInAt})
     .OrderByDescending(x=>x.CheckedInAt).Take(100).ToListAsync();
   return Results.Ok(new{count=entries.Count,entries});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));

  app.MapPost("/api/member/checkin",async(CheckinRequest req,ClaimsPrincipal principal,GymDbContext db,IConfiguration cfg)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId)||!Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   if(string.IsNullOrWhiteSpace(req.Code)||!Validate(gymId,req.Code,cfg["Jwt:Key"]!))
    return Results.BadRequest(new{message="QR inválido o vencido. Escaneá el código actualizado en recepción."});
   var now=DateTimeOffset.UtcNow;
   var today=DateOnly.FromDateTime(now.UtcDateTime);
   if(!await db.Subscriptions.AsNoTracking().AnyAsync(s=>s.GymId==gymId&&s.MemberId==memberId&&s.StartDate<=today&&s.EndDate>=today))
    return Results.BadRequest(new{message="Tu membresía no está activa. Consultá en recepción."});
   // One entry per member per UTC day; a durable unique daily constraint is recommended for higher concurrency.
   if(await db.Attendances.AnyAsync(a=>a.GymId==gymId&&a.MemberId==memberId&&a.CheckedInAt>=new DateTimeOffset(now.UtcDateTime.Date,TimeSpan.Zero)))
    return Results.Conflict(new{message="Tu asistencia de hoy ya fue registrada."});
   db.Attendances.Add(new GymSaaS.Api.Models.Attendance{GymId=gymId,MemberId=memberId,CheckedInAt=now});
   await db.SaveChangesAsync();
   return Results.Ok(new{message="¡Asistencia registrada!",checkedInAt=now});
  }).RequireAuthorization(p=>p.RequireRole("Member")).RequireRateLimiting("auth-ip");
  return app;
 }
}
