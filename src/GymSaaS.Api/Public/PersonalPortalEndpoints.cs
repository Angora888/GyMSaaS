using System.ComponentModel.DataAnnotations;
using Google.Apis.Auth;
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
  group.MapPost("/google",async(GoogleCredential req,GymDbContext db,IConfiguration config)=>{
   var clientId=config["Google:ClientId"];
   if(string.IsNullOrWhiteSpace(clientId))return Results.Problem("El inicio con Google no está configurado.",statusCode:503);
   if(string.IsNullOrWhiteSpace(req.Credential))return Results.Unauthorized();
   GoogleJsonWebSignature.Payload payload;
   try{
    payload=await GoogleJsonWebSignature.ValidateAsync(req.Credential,new GoogleJsonWebSignature.ValidationSettings{Audience=new[]{clientId}});
   }catch(InvalidJwtException){return Results.Unauthorized();}
   if(payload.EmailVerified!=true||string.IsNullOrWhiteSpace(payload.Subject)||string.IsNullOrWhiteSpace(payload.Email))return Results.Unauthorized();
   if(!await db.Gyms.AsNoTracking().AnyAsync(x=>x.Id==PersonalGymId&&x.IsActive))
    return Results.Problem("Mi Rutina no está configurada.",statusCode:503);
   var identity=await db.MemberIdentities.AsNoTracking()
    .SingleOrDefaultAsync(x=>x.GymId==PersonalGymId&&x.GoogleSubject==payload.Subject);
   if(identity is not null)return Results.Ok(new{token=GymPortalEndpoints.MemberToken(identity,config)});
   var email=payload.Email.Trim().ToLowerInvariant();
   // Never silently join an existing password account: use explicit verified linking in a later feature.
   if(await db.MemberIdentities.AsNoTracking().AnyAsync(x=>x.GymId==PersonalGymId&&x.Email==email))
    return Results.Conflict(new{message="Ya tenés una cuenta personal con ese correo. Ingresá con contraseña; la vinculación de Google estará disponible próximamente."});
   await using var transaction=await db.Database.BeginTransactionAsync();
   try{
    // Controlled beta migration: only the explicitly authorized test account.
    // Google has verified the mailbox AND its stable subject must match the old identity.
    // The original gym member, routine and sessions are NEVER modified.
    var legacy= email=="angora88@gmail.com"
      ? await (from id in db.MemberIdentities.AsNoTracking()
               join m in db.Members.AsNoTracking() on new{id.GymId,Id=id.MemberId} equals new{m.GymId,m.Id}
               join g in db.Gyms.AsNoTracking() on m.GymId equals g.Id
               where g.Slug=="mirutina" && id.GoogleSubject==payload.Subject && id.Email==email
               select new{Member=m}).SingleOrDefaultAsync()
      : null;
    var member=new Member{
      GymId=PersonalGymId,
      FullName=legacy?.Member.FullName ?? (string.IsNullOrWhiteSpace(payload.Name)?email.Split('@')[0]:payload.Name.Trim()),
      Email=email,
      Phone=legacy?.Member.Phone,
      EmergencyPhone=legacy?.Member.EmergencyPhone,
      WeightKg=legacy?.Member.WeightKg,
      HeightCm=legacy?.Member.HeightCm
    };
    db.Members.Add(member);
    await db.SaveChangesAsync();
    var newIdentity=new MemberIdentity{GymId=PersonalGymId,MemberId=member.Id,Email=email,GoogleSubject=payload.Subject,PasswordHash=""};
    db.MemberIdentities.Add(newIdentity);
    await db.SaveChangesAsync();
    var migratedPrograms=0;
    var migratedSessions=0;
    if(legacy is not null){
      var oldGym=legacy.Member.GymId;
      var oldMember=legacy.Member.Id;
      var programs=await db.MemberWorkoutPrograms.AsNoTracking()
        .Where(x=>x.GymId==oldGym && x.MemberId==oldMember).ToListAsync();
      var programIds=new Dictionary<Guid,Guid>();
      foreach(var p in programs){
        var copy=new MemberWorkoutProgram{
          GymId=PersonalGymId,MemberId=member.Id,Name=p.Name,Description=p.Description,
          IsActive=p.IsActive,DaysJson=p.DaysJson,CreatedAt=p.CreatedAt
        };
        db.MemberWorkoutPrograms.Add(copy);
        programIds[p.Id]=copy.Id;
      }
      await db.SaveChangesAsync();
      migratedPrograms=programs.Count;
      var sessions=await db.MemberWorkoutSessions.AsNoTracking()
        .Where(x=>x.GymId==oldGym && x.MemberId==oldMember).ToListAsync();
      foreach(var s in sessions){
        if(!programIds.TryGetValue(s.ProgramId,out var newProgramId))
          throw new InvalidOperationException("Sesión sin rutina de origen.");
        db.MemberWorkoutSessions.Add(new MemberWorkoutSession{
          GymId=PersonalGymId,MemberId=member.Id,ProgramId=newProgramId,
          DayId=s.DayId,CompletedJson=s.CompletedJson,WeightsJson=s.WeightsJson,
          StartedAt=s.StartedAt,FinishedAt=s.FinishedAt
        });
      }
      migratedSessions=sessions.Count;
      var measurements=await db.MemberMeasurements.AsNoTracking()
        .Where(x=>x.GymId==oldGym && x.MemberId==oldMember).ToListAsync();
      foreach(var measure in measurements){
        db.MemberMeasurements.Add(new MemberMeasurement{
          GymId=PersonalGymId,MemberId=member.Id,
          WeightKg=measure.WeightKg,HeightCm=measure.HeightCm,RecordedAt=measure.RecordedAt
        });
      }
      await db.SaveChangesAsync();
    }
    await transaction.CommitAsync();
    return Results.Ok(new{
      token=GymPortalEndpoints.MemberToken(newIdentity,config),
      migrated=legacy is not null,migratedPrograms,migratedSessions
    });
   }catch(DbUpdateException ex) when(ex.InnerException is PostgresException {SqlState:PostgresErrorCodes.UniqueViolation}){
    await transaction.RollbackAsync();
    return Results.Conflict(new{message="Ya existe una cuenta con este correo. Ingresá con tu método habitual."});
   }catch(DbUpdateException){
    await transaction.RollbackAsync();
    return Results.Problem("No fue posible registrar la cuenta con Google.",statusCode:500);
   }
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
