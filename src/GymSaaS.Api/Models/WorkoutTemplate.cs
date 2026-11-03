namespace GymSaaS.Api.Models;
public sealed class WorkoutTemplate {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public required string Name {get;set;}
 public string? Description {get;set;}
 public required string DaysJson {get;set;}
 public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow;
}
