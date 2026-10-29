using Google.Apis.Auth;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Public;
public sealed record GoogleCredential(string Credential);
public static class GoogleMemberEndpoints {
 public static IEndpointRouteBuilder MapGoogleMember(this IEndpointRouteBuilder app){
  app.MapPost("/api/public/gyms/{slug}/google",async(string slug,GoogleCredential req,GymDbContext db,IConfiguration config)=>{
   var clientId=config["Google:ClientId"];
   if(string.IsNullOrEmpty(clientId))return Results.Problem("Google not configured",statusCode:503);
   GoogleJsonWebSignature.Payload payload;
   try{payload=await GoogleJsonWebSignature.ValidateAsync(req.Credential,new GoogleJsonWebSignature.ValidationSettings{Audience=new[]{clientId}});}
   catch(InvalidJwtException){return Results.Unauthorized();}
   if(payload.EmailVerified!=true||string.IsNullOrEmpty(payload.Subject)||string.IsNullOrEmpty(payload.Email))return Results.Unauthorized();
   var gym=await db.Gyms.FirstOrDefaultAsync(g=>g.Slug==slug&&g.IsActive);
   if(gym==null)return Results.NotFound();
   var identity=await db.MemberIdentities.FirstOrDefaultAsync(i=>i.GymId==gym.Id&&i.GoogleSubject==payload.Subject);
   if(identity==null){
    var email=payload.Email.Trim().ToLowerInvariant();
    if(await db.MemberIdentities.AnyAsync(i=>i.GymId==gym.Id&&i.Email==email))
     return Results.Conflict(new{message="Ya existe una cuenta con este correo. Ingresá con contraseña; vincularemos Google desde tu perfil."});
    await using var transaction=await db.Database.BeginTransactionAsync();
    var member=new Member{GymId=gym.Id,FullName=string.IsNullOrWhiteSpace(payload.Name)?"Miembro":payload.Name,Email=email};
    identity=new MemberIdentity{GymId=gym.Id,MemberId=member.Id,Email=email,GoogleSubject=payload.Subject,PasswordHash=""};
    db.Members.Add(member);
    db.MemberIdentities.Add(identity);
    try{await db.SaveChangesAsync();await transaction.CommitAsync();}
    catch(DbUpdateException){await transaction.RollbackAsync();return Results.Conflict(new{message="No se pudo registrar; intentá nuevamente."});}
   }
   return Results.Ok(new{token=GymPortalEndpoints.MemberToken(identity,config)});
  }).RequireRateLimiting("auth-ip");
  return app;
 }
}
