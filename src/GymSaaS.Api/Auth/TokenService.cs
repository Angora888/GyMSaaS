using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GymSaaS.Api.Models;
using Microsoft.IdentityModel.Tokens;
namespace GymSaaS.Api.Auth;
public sealed class TokenService(IConfiguration config) {
 public object Issue(AppUser user){
  var secret=config["Jwt:Key"] ?? throw new InvalidOperationException("Configure Jwt__Key");
  if(Encoding.UTF8.GetByteCount(secret)<32) throw new InvalidOperationException("Jwt key must be >= 32 bytes.");
  var expires=DateTime.UtcNow.AddHours(8);
  var claims=new[] { new Claim(JwtRegisteredClaimNames.Sub,user.Id.ToString()),new Claim(JwtRegisteredClaimNames.Email,user.Email),new Claim("gym_id",user.GymId.ToString()),new Claim(ClaimTypes.Role,user.Role) };
  var credentials=new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),SecurityAlgorithms.HmacSha256);
  var jwt=new JwtSecurityToken(issuer:config["Jwt:Issuer"]??"GymSaaS",audience:config["Jwt:Audience"]??"GymSaaS.Client",claims:claims,expires:expires,signingCredentials:credentials);
  return new { accessToken=new JwtSecurityTokenHandler().WriteToken(jwt),expiresAt=expires,tokenType="Bearer" };
 }
}
