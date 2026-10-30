namespace GymSaaS.Api.Models;
public sealed class TrainerMember {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid TrainerId {get;set;}
 public Guid MemberId {get;set;}
 public DateTimeOffset AssignedAt {get;set;}=DateTimeOffset.UtcNow;
}
