using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace GymSaaS.Api.Public;
public sealed record MemberSignup([property:Required,MinLength(2),MaxLength(150)] string FullName,[property:Required,EmailAddress] string Email,[property:Required,MinLength(12)] string Password);
public sealed record MemberLogin([property:Required,EmailAddress] string Email,[property:Required] string Password);
public static class GymPortalEndpoints {
 static object Token(MemberIdentity identity,IConfiguration config){
  var key=config["Jwt:Key"]??throw new InvalidOperationException("JWT key missing");
  var claims=new[]{new Claim(JwtRegisteredClaimNames.Sub,identity.Id.ToString()),new Claim("gym_id",identity.GymId.ToString()),new Claim("member_id",identity.MemberId.ToString()),new Claim(ClaimTypes.Role,"Member")};
  var jwt=new JwtSecurityToken(issuer:config["Jwt:Issuer"]??"GymSaaS",audience:config["Jwt:Audience"]??"GymSaaS.Client",claims:claims,expires:DateTime.UtcNow.AddHours(4),signingCredentials:new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),SecurityAlgorithms.HmacSha256));
  return new{accessToken=new JwtSecurityTokenHandler().WriteToken(jwt),tokenType="Bearer"};
 }
 public static IEndpointRouteBuilder MapGymPortal(this IEndpointRouteBuilder app){
  app.MapGet("/api/public/gyms/{slug}",async(string slug,GymDbContext db)=>{
   var gym=await db.Gyms.AsNoTracking().Where(g=>g.Slug==slug&&g.IsActive).Select(g=>new{g.Name,g.Slug}).SingleOrDefaultAsync();
   return gym is null?Results.NotFound():Results.Ok(gym);
  });
  app.MapPost("/api/public/gyms/{slug}/signup",async(string slug,MemberSignup input,GymDbContext db,IConfiguration config,IPasswordHasher<MemberIdentity> hasher)=>{
   var validator=new List<ValidationResult>();
   if(!Validator.TryValidateObject(input,new ValidationContext(input),validator,true)||string.IsNullOrWhiteSpace(input.FullName))return Results.ValidationProblem(new Dictionary<string,string[]>{{"signup",["Datos de registro inválidos."]}});
   var gym=await db.Gyms.AsNoTracking().Where(g=>g.Slug==slug&&g.IsActive).Select(g=>new{g.Id}).SingleOrDefaultAsync();
   if(gym is null)return Results.NotFound();
   var email=input.Email.Trim().ToLowerInvariant();
   if(await db.MemberIdentities.AnyAsync(x=>x.GymId==gym.Id&&x.Email==email))return Results.Conflict(new{message="Esta cuenta ya está registrada en el gimnasio."});
   await using var tx=await db.Database.BeginTransactionAsync();
   var member=new Member{GymId=gym.Id,FullName=input.FullName.Trim(),Email=email};
   var identity=new MemberIdentity{GymId=gym.Id,MemberId=member.Id,Email=email,PasswordHash=""};
   identity.PasswordHash=hasher.HashPassword(identity,input.Password);
   db.Members.Add(member);db.MemberIdentities.Add(identity);
   try{await db.SaveChangesAsync();await tx.CommitAsync();}
   catch(DbUpdateException){await tx.RollbackAsync();return Results.Conflict(new{message="No fue posible completar el registro. Verifica que no exista la cuenta."});}
   return Results.Ok(new{token=Token(identity,config),member=new{member.Id,member.FullName,member.Email}});
  });
  app.MapPost("/api/public/gyms/{slug}/login",async(string slug,MemberLogin input,GymDbContext db,IConfiguration config,IPasswordHasher<MemberIdentity> hasher)=>{
   var gym=await db.Gyms.AsNoTracking().SingleOrDefaultAsync(g=>g.Slug==slug&&g.IsActive);
   if(gym is null)return Results.NotFound();
   var identity=await db.MemberIdentities.AsNoTracking().SingleOrDefaultAsync(x=>x.GymId==gym.Id&&x.Email==input.Email.Trim().ToLowerInvariant());
   if(identity is null||hasher.VerifyHashedPassword(identity,identity.PasswordHash,input.Password)==PasswordVerificationResult.Failed)return Results.Unauthorized();
   return Results.Ok(new{token=Token(identity,config)});
  });
  app.MapGet("/api/member/me",async(ClaimsPrincipal user,GymDbContext db)=>{
   if(!Guid.TryParse(user.FindFirstValue("gym_id"),out var gym)||!Guid.TryParse(user.FindFirstValue("member_id"),out var memberId))return Results.Unauthorized();
   var data=await db.Members.AsNoTracking().Where(x=>x.GymId==gym&&x.Id==memberId).Select(x=>new{x.Id,x.FullName,x.Email,x.Phone}).FirstOrDefaultAsync();
   return data is null?Results.Unauthorized():Results.Ok(data);
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  return app;
 }
}
