using GymSaaS.Api.Data;
using GymSaaS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSaaS.Api.Public;

// Called only after an existing account has been authenticated.
// Copying data rather than moving it preserves the source as a backup.
public static class PersonalAccountCopy {
 public static async Task<(int programs,int sessions)> CopyAsync(GymDbContext db,Member source,Member destination){
  var originals=await db.MemberWorkoutPrograms.AsNoTracking()
    .Where(p=>p.GymId==source.GymId&&p.MemberId==source.Id).ToListAsync();
  var mapping=new Dictionary<Guid,Guid>();
  foreach(var p in originals){
   var copy=new MemberWorkoutProgram{GymId=destination.GymId,MemberId=destination.Id,
    Name=p.Name,Description=p.Description,IsActive=p.IsActive,
    DaysJson=p.DaysJson,CreatedAt=p.CreatedAt};
   db.MemberWorkoutPrograms.Add(copy);mapping.Add(p.Id,copy.Id);
  }
  await db.SaveChangesAsync();
  var sessions=await db.MemberWorkoutSessions.AsNoTracking()
   .Where(s=>s.GymId==source.GymId&&s.MemberId==source.Id).ToListAsync();
  foreach(var session in sessions){
   if(!mapping.TryGetValue(session.ProgramId,out var programId))
    throw new InvalidOperationException("Missing source program");
   db.MemberWorkoutSessions.Add(new MemberWorkoutSession{
    GymId=destination.GymId,MemberId=destination.Id,ProgramId=programId,
    DayId=session.DayId,CompletedJson=session.CompletedJson,
    WeightsJson=session.WeightsJson,StartedAt=session.StartedAt,
    FinishedAt=session.FinishedAt
   });
  }
  var measurements=await db.MemberMeasurements.AsNoTracking()
   .Where(m=>m.GymId==source.GymId&&m.MemberId==source.Id).ToListAsync();
  foreach(var m in measurements)db.MemberMeasurements.Add(new MemberMeasurement{
   GymId=destination.GymId,MemberId=destination.Id,
   WeightKg=m.WeightKg,HeightCm=m.HeightCm,RecordedAt=m.RecordedAt
  });
  await db.SaveChangesAsync();
  return (originals.Count,sessions.Count);
 }
}
