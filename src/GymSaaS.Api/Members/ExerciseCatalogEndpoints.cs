using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Claims;
using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using GymSaaS.Api.Public;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Members;
public sealed record CatalogEntry(string Category,string Name,int DefaultSets=4,int DefaultReps=10,int DefaultRestSeconds=120,string? Notes=null,string ExerciseType="reps",int DurationSeconds=0,string? Instructions=null);
public sealed record CatalogImageInput(string? ImageUrl);
public sealed record CatalogDetailsInput(string ExerciseType,int DurationSeconds,string? Instructions);
public sealed record CatalogImport(List<CatalogEntry> Exercises);
public static class ExerciseCatalogEndpoints {
 public static IEndpointRouteBuilder MapExerciseCatalog(this IEndpointRouteBuilder app){
  var group=app.MapGroup("/api/admin/exercise-catalog").RequireAuthorization(p=>p.RequireRole("Owner"));
  group.MapGet("",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   return Results.Ok(await db.ExerciseCatalogItems.AsNoTracking().Where(x=>x.GymId==gym).OrderBy(x=>x.Category).ThenBy(x=>x.Name).Select(x=>new{x.Id,x.Category,x.Name,x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes,x.ImageUrl,x.ExerciseType,x.DurationSeconds,x.Instructions}).ToListAsync());
  });
  app.MapGet("/api/member/exercise-catalog",async(ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gymId)||!Guid.TryParse(principal.FindFirst("member_id")?.Value,out var memberId))return Results.Unauthorized();
   if(!await db.Members.AnyAsync(m=>m.Id==memberId&&m.GymId==gymId))return Results.Unauthorized();
   return Results.Ok(await db.ExerciseCatalogItems.AsNoTracking().Where(x=>x.GymId==gymId)
    .OrderBy(x=>x.Category).ThenBy(x=>x.Name)
    .Select(x=>new{x.Id,x.Category,x.Name,x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes,x.ImageUrl}).ToListAsync());
  }).RequireAuthorization(p=>p.RequireRole("Member"));
  group.MapPut("/{id:guid}/details",async(Guid id,CatalogDetailsInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(input.ExerciseType is not ("reps" or "timed" or "isometric") || input.DurationSeconds<0 || input.DurationSeconds>3600 || (input.ExerciseType!="reps"&&input.DurationSeconds<1) || input.Instructions?.Length>2000)
    return Results.BadRequest(new{message="Tipo, duración o instrucciones inválidas."});
   var item=await db.ExerciseCatalogItems.SingleOrDefaultAsync(x=>x.Id==id&&x.GymId==gym);
   if(item is null)return Results.NotFound();
   item.ExerciseType=input.ExerciseType;item.DurationSeconds=input.ExerciseType=="reps"?0:input.DurationSeconds;item.Instructions=input.Instructions?.Trim();
   await db.SaveChangesAsync();
   return Results.Ok(new{item.Id,item.ExerciseType,item.DurationSeconds,item.Instructions});
  });
  group.MapPut("/{id:guid}/image",async(Guid id,CatalogImageInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var image=input.ImageUrl?.Trim();
   if(image is {Length:>160000} || (image is {Length:>0} && !(Uri.TryCreate(image,UriKind.Absolute,out var uri) && uri.Scheme=="https") && !System.Text.RegularExpressions.Regex.IsMatch(image,@"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$")))
    return Results.BadRequest(new{message="Usá una URL HTTPS o una imagen JPG, PNG o WebP de hasta 120 KB."});
   var item=await db.ExerciseCatalogItems.SingleOrDefaultAsync(x=>x.Id==id&&x.GymId==gym);
   if(item is null)return Results.NotFound();
   item.ImageUrl=string.IsNullOrWhiteSpace(image)?null:image;
   await db.SaveChangesAsync();
   return Results.Ok(new{item.Id,item.ImageUrl});
  });
  // Owner-only, optional GitHub-backed static asset upload. No image bytes are stored in Neon.
  group.MapPost("/{id:guid}/image-file",async(Guid id,CatalogImageInput input,ClaimsPrincipal principal,GymDbContext db,IHttpClientFactory clients,IConfiguration config)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   var item=await db.ExerciseCatalogItems.SingleOrDefaultAsync(x=>x.Id==id&&x.GymId==gym);
   if(item is null)return Results.NotFound();
   var token=config["ExerciseImages:GitHubToken"];
   if(string.IsNullOrWhiteSpace(token))return Results.Problem("La carga al repositorio no está configurada. Configurá ExerciseImages__GitHubToken en el backend.",statusCode:503);
   var data=input.ImageUrl??"";
   const string prefix="data:image/webp;base64,";
   if(!data.StartsWith(prefix,StringComparison.Ordinal)||data.Length>300000)
    return Results.BadRequest(new{message="Solo se permiten imágenes WebP optimizadas de hasta 220 KB."});
   byte[] bytes;
   try {bytes=Convert.FromBase64String(data[prefix.Length..]);}
   catch(FormatException){return Results.BadRequest(new{message="Imagen Base64 no válida."});}
   if(bytes.Length<16||bytes.Length>220000||Encoding.ASCII.GetString(bytes,0,4)!="RIFF"||Encoding.ASCII.GetString(bytes,8,4)!="WEBP")
    return Results.BadRequest(new{message="El archivo no es una imagen WebP válida o supera 220 KB."});
   static string Slug(string value){
    var normalized=value.Normalize(NormalizationForm.FormD);
    var clean=new string(normalized.Where(c=>System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)!=System.Globalization.UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();
    return Regex.Replace(Regex.Replace(clean,@"[^a-z0-9]+","-"),@"^-|-$","");
   }
   var category=Slug(item.Category);var name=Slug(item.Name);
   if(category.Length==0||name.Length==0)return Results.BadRequest(new{message="Nombre de ejercicio o categoría inválido."});
   var repo=config["ExerciseImages:GitHubRepository"]??"Angora888/GyMSaaS";
   if(!Regex.IsMatch(repo,@"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"))return Results.Problem("Repositorio de imágenes mal configurado.",statusCode:503);
   var branch=config["ExerciseImages:GitHubBranch"]??"main";
   var path=$"frontend/public/ejercicios/{category}/{name}.webp";
   var url=$"https://api.github.com/repos/{repo}/contents/{path}";
   using var client=clients.CreateClient();
   client.DefaultRequestHeaders.UserAgent.ParseAdd("GymSaaS-ExerciseImages/1.0");
   client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
   client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);
   client.Timeout=TimeSpan.FromSeconds(25);
   try {
    string? sha=null;
    using(var existing=await client.GetAsync(url+"?ref="+Uri.EscapeDataString(branch))){
     if(existing.IsSuccessStatusCode){
      using var doc=JsonDocument.Parse(await existing.Content.ReadAsStringAsync());
      sha=doc.RootElement.GetProperty("sha").GetString();
     }else if(existing.StatusCode!=System.Net.HttpStatusCode.NotFound)
      return Results.Problem("No se pudo consultar la imagen en GitHub.",statusCode:502);
    }
    var payload=new Dictionary<string,object?>{
     ["message"]=$"Update exercise image: {item.Category}/{item.Name}",
     ["content"]=Convert.ToBase64String(bytes),["branch"]=branch
    };
    if(sha is not null)payload["sha"]=sha;
    using var response=await client.PutAsync(url,new StringContent(JsonSerializer.Serialize(payload),Encoding.UTF8,"application/json"));
    if(!response.IsSuccessStatusCode)return Results.Problem("GitHub rechazó la subida de la imagen. Verificá los permisos del token y la rama.",statusCode:502);
    // Clear former inline image only after GitHub confirms the new file was committed.
    item.ImageUrl=null;
    await db.SaveChangesAsync();
    return Results.Ok(new{path="/ejercicios/"+category+"/"+name+".webp",published=false,message="Imagen enviada a GitHub. Vercel debe completar el despliegue."});
   }catch(HttpRequestException){return Results.Problem("No se pudo conectar a GitHub.",statusCode:502);}
    catch(TaskCanceledException){return Results.Problem("La subida a GitHub agotó el tiempo de espera.",statusCode:504);}
  });
  group.MapPost("/import",async(CatalogImport input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(input.Exercises is null||input.Exercises.Count is <1 or >500)return Results.BadRequest(new{message="El catálogo debe contener entre 1 y 500 ejercicios."});
   var items=input.Exercises.Select(x=>new CatalogEntry(x.Category?.Trim()??"",x.Name?.Trim()??"",x.DefaultSets,x.DefaultReps,x.DefaultRestSeconds,x.Notes?.Trim(),x.ExerciseType??"reps",x.DurationSeconds,x.Instructions?.Trim())).ToList();
   if(items.Any(x=>x.Category.Length is <2 or >80||x.Name.Length is <2 or >120||x.DefaultSets is <1 or >20||x.DefaultReps is <1 or >1000||x.DefaultRestSeconds is <0 or >3600||x.Notes?.Length>500||x.ExerciseType is not ("reps" or "timed" or "isometric")||x.DurationSeconds<0||x.DurationSeconds>3600||(x.ExerciseType!="reps"&&x.DurationSeconds<1)||x.Instructions?.Length>2000))
    return Results.BadRequest(new{message="Revisá categorías, nombres, series, repeticiones y descansos."});
   var duplicates=items.GroupBy(x=>x.Category.ToLowerInvariant()+"|"+x.Name.ToLowerInvariant()).Any(g=>g.Count()>1);
   if(duplicates)return Results.BadRequest(new{message="El archivo tiene ejercicios duplicados en una categoría."});
   var existing=await db.ExerciseCatalogItems.Where(x=>x.GymId==gym).ToListAsync();
   var byKey=existing.ToDictionary(x=>x.Category.ToLowerInvariant()+"|"+x.Name.ToLowerInvariant());
   int added=0,updated=0;
   foreach(var e in items){
    var key=e.Category.ToLowerInvariant()+"|"+e.Name.ToLowerInvariant();
    if(!byKey.TryGetValue(key,out var row)){row=new ExerciseCatalogItem{GymId=gym,Category=e.Category,Name=e.Name};db.ExerciseCatalogItems.Add(row);byKey[key]=row;added++;}else updated++;
    row.DefaultSets=e.DefaultSets;row.DefaultReps=e.DefaultReps;row.DefaultRestSeconds=e.DefaultRestSeconds;row.Notes=e.Notes;row.ExerciseType=e.ExerciseType;row.DurationSeconds=e.ExerciseType=="reps"?0:e.DurationSeconds;row.Instructions=e.Instructions;
   }
   await db.SaveChangesAsync();
   return Results.Ok(new{added,updated,total=byKey.Count});
  });
  group.MapPost("/members/{memberId:guid}/assign",async(Guid memberId,WorkoutProgramInput input,ClaimsPrincipal principal,GymDbContext db)=>{
   if(!Guid.TryParse(principal.FindFirst("gym_id")?.Value,out var gym))return Results.Unauthorized();
   if(!await db.Members.AnyAsync(m=>m.GymId==gym&&m.Id==memberId))return Results.NotFound();
   if(!MemberWorkoutEndpoints.Valid(input))return Results.BadRequest(new{message="La rutina contiene ejercicios, días o series inválidos."});
   if(input.IsActive){var prior=await db.MemberWorkoutPrograms.Where(x=>x.GymId==gym&&x.MemberId==memberId&&x.IsActive).ToListAsync();foreach(var p in prior)p.IsActive=false;}
   var entity=new MemberWorkoutProgram{GymId=gym,MemberId=memberId,Name=input.Name.Trim(),Description=input.Description?.Trim(),IsActive=input.IsActive,DaysJson=System.Text.Json.JsonSerializer.Serialize(input.Days)};
   db.MemberWorkoutPrograms.Add(entity);await db.SaveChangesAsync();
   return Results.Ok(new{entity.Id,entity.Name});
  });
  return app;
 }
}
