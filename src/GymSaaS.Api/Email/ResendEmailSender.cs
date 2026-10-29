using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net;
namespace GymSaaS.Api.Email;
public interface ITransactionalEmailSender {
 Task SendAsync(string recipient,string subject,string text,CancellationToken cancellationToken=default);
}
public sealed class ResendEmailSender(HttpClient client,IConfiguration config,ILogger<ResendEmailSender> logger):ITransactionalEmailSender {
 public async Task SendAsync(string recipient,string subject,string text,CancellationToken cancellationToken=default){
  var key=config["Resend:ApiKey"];
  var sender=config["Resend:From"];
  if(string.IsNullOrWhiteSpace(key)||string.IsNullOrWhiteSpace(sender))
   throw new InvalidOperationException("Resend is not configured. Set Resend__ApiKey and Resend__From in Azure.");
  using var request=new HttpRequestMessage(HttpMethod.Post,"https://api.resend.com/emails");
  request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",key);
  request.Headers.UserAgent.ParseAdd("GymSaaS/1.0");
  request.Content=JsonContent.Create(new {from=sender,to=new[]{recipient},subject,text});
  using var response=await client.SendAsync(request,cancellationToken);
  if(!response.IsSuccessStatusCode){
   logger.LogError("Resend delivery rejected: HTTP {StatusCode}",(int)response.StatusCode);
   throw new HttpRequestException("Email delivery failed.",null,response.StatusCode);
  }
 }
}
