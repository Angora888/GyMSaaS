using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record MemberInput(
 [property: Required, MinLength(2), MaxLength(150)] string FullName,
 [property: EmailAddress, MaxLength(250)] string? Email,
 [property: MaxLength(40)] string? Phone);
public static class MemberEndpoints {
 public static IEndpointRouteBuilder MapMemberEndpoints(this IEndpointRouteBuilder app) {
  var group=app.MapGroup("/api/members").RequireAuthorization(policy=>policy.RequireRole("Owner"));
  group.MapGet("",async (ClaimsPrincipal principal,GymDbContext db,string? search)=>{
   if(!Tenant(principal,out var gymId))return Results.Unauthorized();
   var query=db.Members.AsNoTracking().Where(x=>x.GymId==gymId);
   if(!string.IsNullOrWhiteSpace(search)){
    var term=search.Trim();
    if(term.Length>100)return Results.BadRequest(new{message="Search is too long."});
    query=query.Where(x=>EF.Functions.ILike(x.FullName,"%"+term+"%") || (x.Email!=null && EF.Functions.ILike(x.Email,"%"+term+"%")));
   }
   return Results.Ok(await query.OrderBy(x=>x.FullName).Take(200).Select(x=>new{x.Id,x.FullName,x.Email,x.Phone}).ToListAsync());
  });
  group.MapPost("",async(ClaimsPrincipal principal,GymDbContext db,MemberInput input)=>{
   if(!Tenant(principal,out var gymId))return Results.Unauthorized();
   if(!Valid(input,out var problem))return problem;
   var member=new Member{GymId=gymId,FullName=input.FullName.Trim(),Email=Clean(input.Email)?.ToLowerInvariant(),Phone=Clean(input.Phone)};
   db.Members.Add(member);await db.SaveChangesAsync();
   return Results.Created($"/api/members/{member.Id}",new{member.Id,member.FullName,member.Email,member.Phone});
  });
  group.MapPut("/{id:guid}",async(Guid id,ClaimsPrincipal principal,GymDbContext db,MemberInput input)=>{
   if(!Tenant(principal,out var gymId))return Results.Unauthorized();
   if(!Valid(input,out var problem))return problem;
   var member=await db.Members.SingleOrDefaultAsync(x=>x.Id==id&&x.GymId==gymId);
   if(member is null)return Results.NotFound();
   member.FullName=input.FullName.Trim();member.Email=Clean(input.Email)?.ToLowerInvariant();member.Phone=Clean(input.Phone);
   await db.SaveChangesAsync();
   return Results.Ok(new{member.Id,member.FullName,member.Email,member.Phone});
  });
  return app;
 }
 static bool Tenant(ClaimsPrincipal principal,out Guid gymId)=>Guid.TryParse(principal.FindFirstValue("gym_id"),out gymId);
 static string? Clean(string? value)=>string.IsNullOrWhiteSpace(value)?null:value.Trim();
 static bool Valid(MemberInput input,out IResult problem){
  var results=new List<ValidationResult>();
  if(!Validator.TryValidateObject(input,new ValidationContext(input),results,true)||string.IsNullOrWhiteSpace(input.FullName)){
   problem=Results.ValidationProblem(new Dictionary<string,string[]>{{"member",results.Select(x=>x.ErrorMessage??"Invalid value").Append("Invalid member data.").ToArray()}});
   return false;
  }
  problem=Results.Ok();return true;
 }
}
