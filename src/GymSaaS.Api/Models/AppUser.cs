namespace GymSaaS.Api.Models;
public sealed class AppUser {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid? TrainerId {get;set;}
 public string? GoogleSubject {get;set;}
 public required string Email {get;set;}
 public required string PasswordHash {get;set;}
 public string FullName {get;set;}="";
 public string Role {get;set;}="Owner";
 public int SessionVersion {get;set;}=0;
 public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
