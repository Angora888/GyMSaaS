using System.Security.Claims;
using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record GymBrandingInput(string Primary,string Accent,string Background,string Tagline,string? LogoUrl);
public static class GymBrandingEndpoints {
 public static IEndpointRouteBuilder MapGymBranding(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/branding").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var id))return Results.Unauthorized();
   var g=await db.Gyms.AsNoTracking().Where(x=>x.Id==id).Select(x=>new{x.Name,x.BrandPrimary,x.BrandAccent,x.BrandBackground,x.BrandTagline,x.BrandLogoUrl}).SingleOrDefaultAsync();
   return g is null?Results.NotFound():Results.Ok(g);
  });
  group.MapPut("",async(GymBrandingInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var id))return Results.Unauthorized();
   bool Color(string s)=>s!=null&&System.Text.RegularExpressions.Regex.IsMatch(s,"^#[0-9a-fA-F]{6}$");
   if(!Color(input.Primary)||!Color(input.Accent)||!Color(input.Background)||input.Tagline?.Length>180||input.Tagline==null)
    return Results.BadRequest(new{message="Revisá los colores y la frase."});
   if(!string.IsNullOrWhiteSpace(input.LogoUrl)&&
    (input.LogoUrl.Length>1000||!Uri.TryCreate(input.LogoUrl,UriKind.Absolute,out var uri)||uri.Scheme!="https"))
    return Results.BadRequest(new{message="El logo debe tener una URL HTTPS válida."});
   var g=await db.Gyms.SingleOrDefaultAsync(x=>x.Id==id);
   if(g is null)return Results.NotFound();
   g.BrandPrimary=input.Primary;g.BrandAccent=input.Accent;g.BrandBackground=input.Background;g.BrandTagline=input.Tagline.Trim();g.BrandLogoUrl=string.IsNullOrWhiteSpace(input.LogoUrl)?null:input.LogoUrl.Trim();
   await db.SaveChangesAsync();return Results.Ok(new{message="Diseño guardado."});
  });
  return app;
 }
}
