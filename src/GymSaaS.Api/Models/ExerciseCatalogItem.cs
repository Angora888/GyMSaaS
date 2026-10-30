namespace GymSaaS.Api.Models;
public sealed class ExerciseCatalogItem {
 public Guid Id {get;set;}=Guid.NewGuid();
 public Guid GymId {get;set;}
 public required string Category {get;set;}
 public required string Name {get;set;}
 public int DefaultSets {get;set;}=4;
 public int DefaultReps {get;set;}=10;
 public int DefaultRestSeconds {get;set;}=120;
 public string? Notes {get;set;}
}
