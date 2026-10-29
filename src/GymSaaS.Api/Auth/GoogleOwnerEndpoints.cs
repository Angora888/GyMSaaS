using Google.Apis.Auth;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
namespace GymSaaS.Api.Auth;
public sealed record GoogleOwnerRequest(string Credential,string? GymName,string? Slug);
public static class GoogleOwnerEndpoints {
 static async Task<GoogleJsonWebSignature.Payload?> Verify(string credential,IConfiguration config) {
  var id=config["Google:ClientId"];
  if(string.IsNullOrWhiteSpace(id)||string.IsNullOrWhiteSpace(credential))return null;
  try {
   var p=await GoogleJsonWebSignature.ValidateAsync(credential,new GoogleJsonWebSignature.ValidationSettings{Audience=new[]{id}});
   return p.EmailVerified==true&&!string.IsNullOrWhiteSpace(p.Subject)&&!string.IsNullOrWhiteSpace(p.Email)?p:null;
  } catch(InvalidJwtException){return null;}
 }
 public static IEndpointRouteBuilder MapGoogleOwner(this IEndpointRouteBuilder app){
  app.MapPost("/api/auth/google",async(GoogleOwnerRequest req,GymDbContext db,IConfiguration cfg,TokenService tokens)=>{
   var p=await Verify(req.Credential,cfg);
   if(p is null)return Results.Unauthorized();
   var email=p.Email.Trim().ToLowerInvariant();
   var existing=await db.Users.FirstOrDefaultAsync(x=>x.GoogleSubject==p.Subject);
   if(existing is not null){
    if(!await db.Gyms.AnyAsync(g=>g.Id==existing.GymId&&g.IsActive))return Results.Unauthorized();
    return Results.Ok(new{token=tokens.Issue(existing),user=new{existing.Id,existing.FullName,existing.Role,existing.GymId}});
   }
   // Never claim an owner account solely because its email matches Google.
   if(await db.Users.AnyAsync(x=>x.Email==email))
    return Results.Conflict(new{message="Ya existe una cuenta con ese correo. Entrá con contraseña y vinculá Google desde Configuración."});
   var slug=(req.Slug??"").Trim().ToLowerInvariant();
   var name=(req.GymName??"").Trim();
   if(name.Length<2||name.Length>120||!System.Text.RegularExpressions.Regex.IsMatch(slug,"^[a-z0-9-]{3,60}$"))
    return Results.BadRequest(new{message="Para registrar un gimnasio con Google ingresá el nombre y un identificador válido."});
   if(await db.Gyms.AnyAsync(x=>x.Slug==slug))return Results.Conflict(new{message="Identificador de gimnasio en uso."});
   await using var tx=await db.Database.BeginTransactionAsync();
   var gym=new Gym{Name=name,Slug=slug};
   var user=new AppUser{GymId=gym.Id,GoogleSubject=p.Subject,Email=email,FullName=string.IsNullOrWhiteSpace(p.Name)?"Propietario":p.Name,PasswordHash=""};
   db.Gyms.Add(gym);db.Users.Add(user);
   try{await db.SaveChangesAsync();await tx.CommitAsync();}
   catch(DbUpdateException){await tx.RollbackAsync();return Results.Conflict(new{message="El correo o gimnasio ya está registrado."});}
   return Results.Ok(new{token=tokens.Issue(user),user=new{user.Id,user.FullName,user.Role,user.GymId}});
  }).RequireRateLimiting("auth-ip");
  app.MapPost("/api/auth/google/link",async(GoogleOwnerRequest req,ClaimsPrincipal principal,GymDbContext db,IConfiguration cfg)=>{
   if(!Guid.TryParse(principal.FindFirstValue("gym_id"),out var gymId))return Results.Unauthorized();
   var subject=principal.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)??principal.FindFirstValue(ClaimTypes.NameIdentifier);
   if(!Guid.TryParse(subject,out var userId))return Results.Unauthorized();
   var owner=await db.Users.SingleOrDefaultAsync(x=>x.Id==userId&&x.GymId==gymId);
   if(owner is null)return Results.Unauthorized();
   var p=await Verify(req.Credential,cfg);
   if(p is null||!string.Equals(owner.Email,p.Email,StringComparison.OrdinalIgnoreCase))return Results.BadRequest(new{message="Google debe confirmar el mismo correo de tu cuenta."});
   if(owner.GoogleSubject is not null&&owner.GoogleSubject!=p.Subject)return Results.Conflict(new{message="Ya hay otra cuenta Google vinculada."});
   if(await db.Users.AnyAsync(x=>x.GoogleSubject==p.Subject&&x.Id!=owner.Id))return Results.Conflict(new{message="Esta cuenta Google ya está vinculada."});
   owner.GoogleSubject=p.Subject;
   try{await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict();}
   return Results.Ok(new{linked=true});
  }).RequireAuthorization(p=>p.RequireRole("Owner")).RequireRateLimiting("auth-ip");
  return app;
 }
}
