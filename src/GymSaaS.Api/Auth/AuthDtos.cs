using System.ComponentModel.DataAnnotations;
namespace GymSaaS.Api.Auth;
public sealed record RegisterRequest(
 [Required,MinLength(2),MaxLength(120)] string GymName,
 [Required,RegularExpression("^[a-z0-9-]{3,60}$")] string Slug,
 [Required,MinLength(2),MaxLength(120)] string OwnerName,
 [Required,EmailAddress] string Email,
 [Required,MinLength(12)] string Password);
public sealed record LoginRequest([Required,EmailAddress] string Email,[Required] string Password);
