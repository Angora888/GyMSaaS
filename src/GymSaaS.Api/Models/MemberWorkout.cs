namespace GymSaaS.Api.Models;
public sealed class MemberWorkoutProgram {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid MemberId {get;set;}
 public required string Name {get;set;}
 public string? Description {get;set;}
 public bool IsActive {get;set;}=true;
 public required string DaysJson {get;set;}
 public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
public sealed class MemberWorkoutSession {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public Guid MemberId {get;set;}
 public Guid ProgramId {get;set;}
 public required string DayId {get;set;}
 public string CompletedJson {get;set;}="[]";
 public string WeightsJson {get;set;}="{}";
 public DateTimeOffset StartedAt {get;set;}=DateTimeOffset.UtcNow;
 public DateTimeOffset? FinishedAt {get;set;}
}
