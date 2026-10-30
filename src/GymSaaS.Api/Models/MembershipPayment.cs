namespace GymSaaS.Api.Models;
public sealed class MembershipPayment {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid SubscriptionId {get;set;}
 public decimal Amount {get;set;}
 public required string Currency {get;set;}
 public required string Method {get;set;}
 public string? Note {get;set;}
 public DateTimeOffset PaidAt {get;set;}=DateTimeOffset.UtcNow;
 public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
