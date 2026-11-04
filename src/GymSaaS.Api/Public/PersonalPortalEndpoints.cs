using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymSaaS.Api.Public;

/// <summary>
/// Beta personal accounts in a platform-owned tenant (no gym owner).
/// Personal member records never belong to a customer-owned Gym.
/// This is an intentional transitional isolation boundary; global identity and
/// gym linking require a separate migration before linking accounts.
/// </summary>
public static class PersonalPortalEndpoints {
 public static readonly Guid PersonalGymId=Guid.Parse("c0e65f1a-6c32-489a-a6bc-2274db975924");
 public static IEndpointRouteBuilder MapPersonalPortal(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/personal").RequireRateLimiting("auth-ip");
  group.MapPost("/register",async(MemberSignup input,GymDbContext db,IConfiguration config,IPasswordHasher<MemberIdentity> hasher)=>{
   var errors=new List<ValidationResult>();
   if(!Validator.TryValidateObject(input,new ValidationContext(input),errors,true)||string.IsNullOrWhiteSpace(input.FullName))
    return Results.BadRequest(new{message="Revisá el nombre, correo y contraseña (mínimo 12 caracteres)."});
   var email=input.Email.Trim().ToLowerInvariant();
   if(!await db.Gyms.AnyAsync(x=>x.Id==PersonalGymId&&x.IsActive))
    return Results.Problem("Mi Rutina no está configurada.",statusCode:503);
   if(await db.MemberIdentities.AnyAsync(x=>x.GymId==PersonalGymId&&x.Email==email))
    return Results.Conflict(new{message="Este correo ya está registrado en Mi Rutina."});
   await using var tx=await db.Database.BeginTransactionAsync();
   try{
    var member=new Member{GymId=PersonalGymId,FullName=input.FullName.Trim(),Email=email};
    db.Members.Add(member);await db.SaveChangesAsync();
    var identity=new MemberIdentity{GymId=PersonalGymId,MemberId=member.Id,Email=email,PasswordHash=""};
    identity.PasswordHash=hasher.HashPassword(identity,input.Password);
    db.MemberIdentities.Add(identity);await db.SaveChangesAsync();
    await tx.CommitAsync();
    return Results.Ok(new{token=GymPortalEndpoints.MemberToken(identity,config),member=new{member.Id,member.FullName,member.Email}});
   }catch(DbUpdateException ex) when(ex.InnerException is PostgresException{SqlState:PostgresErrorCodes.UniqueViolation}){
    await tx.RollbackAsync();return Results.Conflict(new{message="Este correo ya está registrado en Mi Rutina."});
   }catch(DbUpdateException){
    await tx.RollbackAsync();return Results.Problem("No fue posible crear la cuenta.",statusCode:500);
   }
  });
  group.MapPost("/login",async(MemberLogin input,GymDbContext db,IConfiguration config,IPasswordHasher<MemberIdentity> hasher)=>{
   var email=input.Email?.Trim().ToLowerInvariant()??"";
   if(string.IsNullOrWhiteSpace(input.Password))return Results.Unauthorized();
   var user=await db.MemberIdentities.AsNoTracking().SingleOrDefaultAsync(x=>x.GymId==PersonalGymId&&x.Email==email);
   if(user is null||hasher.VerifyHashedPassword(user,user.PasswordHash,input.Password)==PasswordVerificationResult.Failed)
    return Results.Unauthorized();
   if(!await db.Gyms.AsNoTracking().AnyAsync(x=>x.Id==PersonalGymId&&x.IsActive))return Results.Unauthorized();
   return Results.Ok(new{token=GymPortalEndpoints.MemberToken(user,config)});
  });
  group.MapGet("/me",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym)||gym!=PersonalGymId||
    !Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   var member=await db.Members.AsNoTracking().Where(x=>x.GymId==PersonalGymId&&x.Id==memberId)
    .Select(x=>new{x.Id,x.FullName,x.Email}).SingleOrDefaultAsync();
   return member is null?Results.Unauthorized():Results.Ok(member);
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  return app;
 }
}
