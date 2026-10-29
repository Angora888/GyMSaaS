using GymSaaS.Api.Members;
using GymSaaS.Api.Public;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GymSaaS.Api.Auth;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder=WebApplication.CreateBuilder(args);
var conn=builder.Configuration.GetConnectionString("GymDb");
if(string.IsNullOrWhiteSpace(conn)) throw new InvalidOperationException("Set ConnectionStrings__GymDb.");
var jwtKey=builder.Configuration["Jwt:Key"];
if(string.IsNullOrWhiteSpace(jwtKey)||Encoding.UTF8.GetByteCount(jwtKey)<32) throw new InvalidOperationException("Set Jwt__Key (32+ bytes).");
var jwtIssuer=builder.Configuration["Jwt:Issuer"]??"GymSaaS";
var jwtAudience=builder.Configuration["Jwt:Audience"]??"GymSaaS.Client";
builder.Services.AddDbContext<GymDbContext>(o=>o.UseNpgsql(conn));
builder.Services.AddScoped<IPasswordHasher<AppUser>,PasswordHasher<AppUser>>();
builder.Services.AddScoped<IPasswordHasher<MemberIdentity>,PasswordHasher<MemberIdentity>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>o.TokenValidationParameters=new TokenValidationParameters{
 ValidateIssuer=true,ValidIssuer=jwtIssuer,ValidateAudience=true,ValidAudience=jwtAudience,
 ValidateLifetime=true,ValidateIssuerSigningKey=true,
 IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),ClockSkew=TimeSpan.FromSeconds(30)
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o=>o.AddPolicy("Frontend",p=>p.WithOrigins(builder.Configuration.GetSection("FrontendOrigins").Get<string[]>()??["http://localhost:5173","https://gymsaascr.vercel.app"]).AllowAnyHeader().AllowAnyMethod()));
var app=builder.Build();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health",()=>Results.Ok(new{status="ok",app="GymSaaS"}));
app.MapPost("/api/auth/register",async(RegisterRequest req,GymDbContext db,IPasswordHasher<AppUser> hasher,TokenService tokens)=>{
 var email=req.Email.Trim().ToLowerInvariant();
 var slug=req.Slug.Trim().ToLowerInvariant();
 if(!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email)||req.Password.Length<12||req.GymName.Trim().Length<2||req.OwnerName.Trim().Length<2||!System.Text.RegularExpressions.Regex.IsMatch(slug,"^[a-z0-9-]{3,60}$"))return Results.ValidationProblem(new Dictionary<string,string[]>{{"registration",["Invalid registration fields."]}});
 if(await db.Users.AnyAsync(u=>u.Email==email)||await db.Gyms.AnyAsync(g=>g.Slug==slug))return Results.Conflict(new{message="Email or gym slug already in use."});
 var gym=new Gym{Name=req.GymName.Trim(),Slug=slug};
 var user=new AppUser{GymId=gym.Id,Email=email,FullName=req.OwnerName.Trim(),PasswordHash=""};
 user.PasswordHash=hasher.HashPassword(user,req.Password);
 db.Gyms.Add(gym);db.Users.Add(user);
 try {await db.SaveChangesAsync();}catch(DbUpdateException){return Results.Conflict(new{message="Email or gym slug already in use."});}
 return Results.Ok(new{gymId=gym.Id,gymName=gym.Name,token=tokens.Issue(user)});
}).AddEndpointFilter<ValidationFilter<RegisterRequest>>().AllowAnonymous();
app.MapPost("/api/auth/login",async(LoginRequest req,GymDbContext db,IPasswordHasher<AppUser> hasher,TokenService tokens)=>{
 var email=req.Email.Trim().ToLowerInvariant();
 var user=await db.Users.AsNoTracking().SingleOrDefaultAsync(u=>u.Email==email);
 if(user is null || hasher.VerifyHashedPassword(user,user.PasswordHash,req.Password)==PasswordVerificationResult.Failed)return Results.Unauthorized();
 if(!await db.Gyms.AnyAsync(g=>g.Id==user.GymId&&g.IsActive))return Results.Unauthorized();
 return Results.Ok(new{token=tokens.Issue(user),user=new{user.Id,user.FullName,user.Role,user.GymId}});
}).AddEndpointFilter<ValidationFilter<LoginRequest>>().AllowAnonymous();
app.MapGet("/api/auth/me",async(ClaimsPrincipal principal,GymDbContext db)=>{
 var idText=principal.FindFirstValue(JwtRegisteredClaimNames.Sub)??principal.FindFirstValue(ClaimTypes.NameIdentifier);
 var gymText=principal.FindFirstValue("gym_id");
 if(!Guid.TryParse(idText,out var id)||!Guid.TryParse(gymText,out var gymId))return Results.Unauthorized();
 var user=await db.Users.AsNoTracking().Where(u=>u.Id==id&&u.GymId==gymId).Select(u=>new{u.Id,u.FullName,u.Email,u.Role,u.GymId}).SingleOrDefaultAsync();
 return user is null ? Results.Unauthorized() : Results.Ok(user);
}).RequireAuthorization();
app.MapGet("/api/auth/gym",async(ClaimsPrincipal principal,GymDbContext db)=>{
 if(!Guid.TryParse(principal.FindFirstValue("gym_id"),out var gymId))return Results.Unauthorized();
 var gym=await db.Gyms.AsNoTracking().Where(x=>x.Id==gymId&&x.IsActive).Select(x=>new{x.Name,x.Slug}).SingleOrDefaultAsync();
 return gym is null?Results.NotFound():Results.Ok(gym);
}).RequireAuthorization(p=>p.RequireRole("Owner"));
app.MapMemberEndpoints();
app.MapGymPortal();
app.Run();

public sealed class ValidationFilter<T>:IEndpointFilter {
 public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context,EndpointFilterDelegate next){
  var model=context.Arguments.OfType<T>().FirstOrDefault();
  if(model is null)return Results.BadRequest();
  var results=new List<System.ComponentModel.DataAnnotations.ValidationResult>();
  if(!System.ComponentModel.DataAnnotations.Validator.TryValidateObject(model,new System.ComponentModel.DataAnnotations.ValidationContext(model),results,true))
   return Results.ValidationProblem(results.GroupBy(r=>r.MemberNames.FirstOrDefault()??"request").ToDictionary(g=>g.Key,g=>g.Select(r=>r.ErrorMessage??"Invalid").ToArray()));
  return await next(context);
 }
}
