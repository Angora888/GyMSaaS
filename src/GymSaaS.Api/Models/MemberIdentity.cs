namespace GymSaaS.Api.Models;
public sealed class MemberIdentity {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid MemberId {get;set;}
 public required string Email {get;set;}
 public string? GoogleSubject {get;set;}
 public required string PasswordHash {get;set;}
 public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
