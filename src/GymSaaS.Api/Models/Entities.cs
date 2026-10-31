namespace GymSaaS.Api.Models;

public sealed class Gym {
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public bool IsActive { get; set; } = true;
    public string BrandPrimary { get; set; } = "#e64b6a";
    public string BrandAccent { get; set; } = "#f0b45b";
    public string BrandBackground { get; set; } = "#12141b";
    public string BrandTagline { get; set; } = "Entrená con nosotros. Tu progreso comienza aquí.";
    public string? BrandLogoUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Member {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public required string FullName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? EmergencyPhone { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class MembershipPlan {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public required string Name { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "CRC";
    public int DurationDays { get; set; } = 30;
}
public sealed class MemberSubscription {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public Guid MemberId { get; set; }
    public Guid PlanId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}
public sealed class Attendance {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public Guid MemberId { get; set; }
    public DateTimeOffset CheckedInAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CheckedOutAt { get; set; }
}
public sealed class Trainer {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public required string Name { get; set; }
}
public sealed class WorkoutRoutine {
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GymId { get; set; }
    public Guid? MemberId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
}
