using GymSaaS.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var conn = builder.Configuration.GetConnectionString("GymDb");
if (string.IsNullOrWhiteSpace(conn))
    throw new InvalidOperationException("Set ConnectionStrings__GymDb in your environment.");

builder.Services.AddDbContext<GymDbContext>(o => o.UseNpgsql(conn));
builder.Services.AddCors(options => options.AddPolicy("Frontend", p =>
    p.WithOrigins(builder.Configuration.GetSection("FrontendOrigins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.MapGet("/health", () => Results.Ok(new { status = "ok", app = "GymSaaS" }));
// Do not expose tenant/member data until authentication and authorization are in place.
app.Run();
