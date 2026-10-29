using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace GymSaaS.Api.Data;
public sealed class GymDbContext(DbContextOptions<GymDbContext> options):DbContext(options){
 public DbSet<Gym> Gyms=>Set<Gym>();
 public DbSet<AppUser> Users=>Set<AppUser>();
 public DbSet<MemberIdentity> MemberIdentities=>Set<MemberIdentity>();
 public DbSet<Member> Members=>Set<Member>();
 public DbSet<MembershipPlan> Plans=>Set<MembershipPlan>();
 public DbSet<MemberSubscription> Subscriptions=>Set<MemberSubscription>();
 public DbSet<Attendance> Attendances=>Set<Attendance>();
 public DbSet<Trainer> Trainers=>Set<Trainer>();
 public DbSet<WorkoutRoutine> Routines=>Set<WorkoutRoutine>();
 protected override void OnModelCreating(ModelBuilder b){
  b.Entity<Gym>().HasIndex(x=>x.Slug).IsUnique();
  b.Entity<AppUser>().HasIndex(x=>x.Email).IsUnique();
  b.Entity<AppUser>().HasIndex(x=>x.GoogleSubject).IsUnique();
  b.Entity<AppUser>().HasIndex(x=>x.GymId);
  b.Entity<MemberIdentity>().HasIndex(x=>new{x.GymId,x.Email}).IsUnique();
  b.Entity<MemberIdentity>().HasIndex(x=>x.MemberId).IsUnique();
  b.Entity<MemberIdentity>().HasIndex(x=>new{x.GymId,x.GoogleSubject}).IsUnique();
  b.Entity<Member>().HasAlternateKey(x=>new{x.GymId,x.Id});
  b.Entity<MemberIdentity>().HasOne<Member>().WithMany().HasForeignKey(x=>new{x.GymId,x.MemberId}).HasPrincipalKey(m=>new{m.GymId,m.Id}).OnDelete(DeleteBehavior.Restrict);
  b.Entity<Member>().HasIndex(x=>new{x.GymId,x.Email});
  b.Entity<Attendance>().HasIndex(x=>new{x.GymId,x.MemberId,x.CheckedInAt});
  b.Entity<MembershipPlan>().Property(x=>x.Price).HasPrecision(12,2);
  foreach(var type in new[]{typeof(Member),typeof(MembershipPlan),typeof(MemberSubscription),typeof(Attendance),typeof(Trainer),typeof(WorkoutRoutine)})
   b.Entity(type).HasIndex("GymId");
 }
}
