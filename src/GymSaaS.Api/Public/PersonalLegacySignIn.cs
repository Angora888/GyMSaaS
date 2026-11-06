using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymSaaS.Api.Public;

public static class PersonalLegacySignIn {
 public static async Task<IResult> Migrate(MemberLogin request,GymDbContext db,IConfiguration config,IPasswordHasher<MemberIdentity> hasher){
  var email=request.Email?.Trim().ToLowerInvariant()??"";
  if(email!="adri12m@hotmail.com"||string.IsNullOrWhiteSpace(request.Password))return Results.Unauthorized();
  var legacy=await (from identity in db.MemberIdentities.AsNoTracking()
    join member in db.Members.AsNoTracking() on new{identity.GymId,Id=identity.MemberId} equals new{member.GymId,member.Id}
    join gym in db.Gyms.AsNoTracking() on member.GymId equals gym.Id
    where gym.Slug=="mirutina"&&identity.Email==email
    select new {identity,member}).SingleOrDefaultAsync();
  if(legacy==null||string.IsNullOrEmpty(legacy.identity.PasswordHash)||
    hasher.VerifyHashedPassword(legacy.identity,legacy.identity.PasswordHash,request.Password)==PasswordVerificationResult.Failed)
    return Results.Unauthorized();
  if(!await db.Gyms.AsNoTracking().AnyAsync(g=>g.Id==PersonalPortalEndpoints.PersonalGymId&&g.IsActive))
    return Results.Problem("Mi Rutina no está disponible.",statusCode:503);
  await using var transaction=await db.Database.BeginTransactionAsync();
  try{
   if(await db.MemberIdentities.AnyAsync(x=>x.GymId==PersonalPortalEndpoints.PersonalGymId&&x.Email==email))
    return Results.Conflict(new{message="La cuenta personal ya existe. Intentá ingresar nuevamente."});
   var old=legacy.member;
   var m=new Member{GymId=PersonalPortalEndpoints.PersonalGymId,FullName=old.FullName,Email=email,
     Phone=old.Phone,EmergencyPhone=old.EmergencyPhone,WeightKg=old.WeightKg,HeightCm=old.HeightCm};
   db.Members.Add(m);await db.SaveChangesAsync();
   var identity=new MemberIdentity{GymId=m.GymId,MemberId=m.Id,Email=email,PasswordHash=""};
   identity.PasswordHash=hasher.HashPassword(identity,request.Password);
   db.MemberIdentities.Add(identity);await db.SaveChangesAsync();
   var result=await PersonalAccountCopy.CopyAsync(db,old,m);
   await transaction.CommitAsync();
   return Results.Ok(new{token=GymPortalEndpoints.MemberToken(identity,config),
     migrated=true,migratedPrograms=result.programs,migratedSessions=result.sessions});
  }catch(DbUpdateException ex) when(ex.InnerException is PostgresException{SqlState:PostgresErrorCodes.UniqueViolation}){
   await transaction.RollbackAsync();
   return Results.Conflict(new{message="La cuenta ya fue creada. Intentá ingresar nuevamente."});
  }catch(DbUpdateException){
   await transaction.RollbackAsync();
   return Results.Problem("No se pudo migrar la cuenta. Los datos originales siguen intactos.",statusCode:500);
  }
 }
}
