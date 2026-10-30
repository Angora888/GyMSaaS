namespace GymSaaS.Api.Models;
public sealed class MemberMeasurement {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid MemberId {get;set;}
 public decimal WeightKg {get;set;}
 public decimal HeightCm {get;set;}
 public DateTimeOffset RecordedAt {get;set;}=DateTimeOffset.UtcNow;
}
