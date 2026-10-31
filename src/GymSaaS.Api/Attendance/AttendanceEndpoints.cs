using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSaaS.Api.CheckIn;
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
   var tz=TimeZoneInfo.FindSystemTimeZoneById("America/Costa_Rica");
   var localDate=TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,tz).Date;
   var begin=new DateTimeOffset(localDate,tz.GetUtcOffset(localDate)).ToUniversalTime();
   var finish=begin.AddDays(1);
   var entries=await db.Attendances.AsNoTracking().Where(a=>a.GymId==gymId&&a.CheckedInAt>=begin&&a.CheckedInAt<finish)
     .Join(db.Members.AsNoTracking(),a=>new{a.GymId,Id=a.MemberId},m=>new{m.GymId,m.Id},(a,m)=>new{m.FullName,a.CheckedInAt})
     .OrderByDescending(x=>x.CheckedInAt).Take(100).ToListAsync();
   return Results.Ok(new{count=entries.Count,entries});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));

  app.MapGet("/api/admin/attendance/present",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var cutoff=DateTimeOffset.UtcNow.AddHours(-2);
   var entries=await db.Attendances.AsNoTracking()
    .Where(a=>a.GymId==gym&&a.CheckedInAt>=cutoff&&a.CheckedOutAt==null)
    .Join(db.Members.AsNoTracking(),a=>new{a.GymId,Id=a.MemberId},m=>new{m.GymId,m.Id},
     (a,m)=>new{m.Id,m.FullName,a.CheckedInAt})
    .OrderByDescending(x=>x.CheckedInAt).ToListAsync();
   var present=entries.GroupBy(x=>x.Id).Select(g=>g.First()).OrderByDescending(x=>x.CheckedInAt).ToList();
   return Results.Ok(new{count=present.Count,members=present,windowMinutes=120});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));

  app.MapGet("/api/admin/attendance/history",async(DateOnly? from,DateOnly? to,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var zone=TimeZoneInfo.FindSystemTimeZoneById("America/Costa_Rica");
   var now=DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,zone).Date);
   var start=from??now.AddDays(-6);var end=to??now;
   if(start>end||end.DayNumber-start.DayNumber>92)return Results.BadRequest(new{message="Seleccioná un rango válido de hasta 93 días."});
   var beginLocal=start.ToDateTime(TimeOnly.MinValue);
   var endLocal=end.AddDays(1).ToDateTime(TimeOnly.MinValue);
   var begin=new DateTimeOffset(beginLocal,zone.GetUtcOffset(beginLocal)).ToUniversalTime();
   var finish=new DateTimeOffset(endLocal,zone.GetUtcOffset(endLocal)).ToUniversalTime();
   var entries=await db.Attendances.AsNoTracking().Where(a=>a.GymId==gym&&a.CheckedInAt>=begin&&a.CheckedInAt<finish)
    .Join(db.Members.AsNoTracking(),a=>new{a.GymId,Id=a.MemberId},m=>new{m.GymId,m.Id},(a,m)=>new{m.Id,m.FullName,a.CheckedInAt})
    .OrderByDescending(x=>x.CheckedInAt).Take(2000).ToListAsync();
   return Results.Ok(new{entries,count=entries.Count,truncated=entries.Count==2000,from=start,to=end});
  }).RequireAuthorization(p=>p.RequireRole("Owner"));

  app.MapPost("/api/member/checkout",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym)||!Guid.TryParse(principal.FindFirst("member_id")?.Value,out var member))
    return Results.Unauthorized();
   var cutoff=DateTimeOffset.UtcNow.AddHours(-2);
   var attendance=await db.Attendances.Where(a=>a.GymId==gym&&a.MemberId==member&&a.CheckedInAt>=cutoff&&a.CheckedOutAt==null)
    .OrderByDescending(a=>a.CheckedInAt).FirstOrDefaultAsync();
   if(attendance is null)return Results.Conflict(new{message="No tenés una entrada activa para finalizar."});
   attendance.CheckedOutAt=DateTimeOffset.UtcNow;
   await db.SaveChangesAsync();
   return Results.Ok(new{message="Salida registrada correctamente.",checkedOutAt=attendance.CheckedOutAt});
  }).RequireAuthorization(p=>p.RequireRole("Member"));

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
