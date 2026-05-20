#include "Physics/MT_CollisionOptimizer.h"
#include "Camera/CameraActor.h"
#include "Kismet/GameplayStatics.h"

UMT_CollisionOptimizer::UMT_CollisionOptimizer()
{
    FullDetailDistance = 500.0f;
    SimplifiedDetailDistance = 1500.0f;
    BoundingBoxDistance = 3000.0f;
    MinScreenSizeForFullDetail = 5.0f;
    HighVelocityThreshold = 500.0f;
    CollisionCooldownFrames = 2;
    PerformanceWarningThresholdMs = 8.0f;

    bEnableDistanceLOD = true;
    bEnableScreenSizeLOD = true;
    bEnableVelocityOptimization = true;
    bEnableCollisionCooldown = true;

    CurrentOptimizationLevel = 2;
    AccumulatedFrameTime = 0.0f;
    FrameCount = 0;
}

void UMT_CollisionOptimizer::InitializeOptimizer()
{
    ResetStatistics();
}

void UMT_CollisionOptimizer::RegisterActorForOptimization(AActor* Actor)
{
    if (!Actor || RegisteredObjects.Contains(Actor))
    {
        return;
    }

    FCollisionObjectInfo ObjectInfo;
    ObjectInfo.OwnerActor = Actor;

    TArray<UPrimitiveComponent*> PrimComponents;
    Actor->GetComponents<UPrimitiveComponent>(PrimComponents);
    if (PrimComponents.Num() > 0)
    {
        ObjectInfo.PrimitiveComponent = PrimComponents[0];
        ObjectInfo.bIsStatic = PrimComponents[0]->IsSimulatingPhysics() == false;
    }

    ObjectInfo.DetailLevel = ECollisionDetailLevel::CDL_Full;
    ObjectInfo.LastCollisionFrame = 0;

    RegisteredObjects.Add(Actor, ObjectInfo);
}

void UMT_CollisionOptimizer::UnregisterActor(AActor* Actor)
{
    if (RegisteredObjects.Contains(Actor))
    {
        FCollisionObjectInfo& Info = RegisteredObjects[Actor];
        ApplyDetailLevel(Info, ECollisionDetailLevel::CDL_Full);
        RegisteredObjects.Remove(Actor);
    }
    ForcedFullDetailActors.Remove(Actor);
}

void UMT_CollisionOptimizer::UpdateCollisionOptimizations(float DeltaTime)
{
    double StartTime = FPlatformTime::Seconds();

    TArray<AActor*> ActorsToRemove;

    for (auto& Pair : RegisteredObjects)
    {
        AActor* Actor = Pair.Key;
        FCollisionObjectInfo& ObjectInfo = Pair.Value;

        if (!IsValid(Actor))
        {
            ActorsToRemove.Add(Actor);
            continue;
        }

        UpdateObjectMetrics(ObjectInfo);

        if (ForcedFullDetailActors.Contains(Actor))
        {
            float RemainingTime = ForcedFullDetailActors[Actor] - DeltaTime;
            if (RemainingTime <= 0.0f)
            {
                ForcedFullDetailActors.Remove(Actor);
            }
            else
            {
                ForcedFullDetailActors[Actor] = RemainingTime;
                ApplyDetailLevel(ObjectInfo, ECollisionDetailLevel::CDL_Full);
                continue;
            }
        }

        if (ShouldSkipCollisionCheck(ObjectInfo))
        {
            CurrentStats.SkippedChecks++;
            continue;
        }

        ECollisionDetailLevel NewDetailLevel = CalculateDetailLevel(ObjectInfo);
        if (NewDetailLevel != ObjectInfo.DetailLevel)
        {
            ApplyDetailLevel(ObjectInfo, NewDetailLevel);
        }

        switch (NewDetailLevel)
        {
        case ECollisionDetailLevel::CDL_Full:
            CurrentStats.FullDetailChecks++;
            break;
        case ECollisionDetailLevel::CDL_Simplified:
            CurrentStats.SimplifiedChecks++;
            break;
        case ECollisionDetailLevel::CDL_BoundingBox:
            CurrentStats.BoundingBoxChecks++;
            break;
        default:
            break;
        }
        CurrentStats.TotalCollisionChecks++;
    }

    for (AActor* Actor : ActorsToRemove)
    {
        RegisteredObjects.Remove(Actor);
    }

    double EndTime = FPlatformTime::Seconds();
    float FrameTimeMs = (EndTime - StartTime) * 1000.0f;

    AccumulatedFrameTime += FrameTimeMs;
    FrameCount++;
    CurrentStats.AverageCollisionTimeMs = AccumulatedFrameTime / FrameCount;
    CurrentStats.PeakCollisionTimeMs = FMath::Max(CurrentStats.PeakCollisionTimeMs, FrameTimeMs);

    if (FrameTimeMs > PerformanceWarningThresholdMs)
    {
        OnPerformanceWarning.Broadcast(FrameTimeMs);
    }
}

void UMT_CollisionOptimizer::SetOptimizationLevel(int32 Level)
{
    CurrentOptimizationLevel = FMath::Clamp(Level, 0, 3);

    switch (CurrentOptimizationLevel)
    {
    case 0:
        FullDetailDistance = 300.0f;
        SimplifiedDetailDistance = 800.0f;
        BoundingBoxDistance = 1500.0f;
        CollisionCooldownFrames = 5;
        break;
    case 1:
        FullDetailDistance = 500.0f;
        SimplifiedDetailDistance = 1500.0f;
        BoundingBoxDistance = 3000.0f;
        CollisionCooldownFrames = 3;
        break;
    case 2:
        FullDetailDistance = 800.0f;
        SimplifiedDetailDistance = 2000.0f;
        BoundingBoxDistance = 4000.0f;
        CollisionCooldownFrames = 2;
        break;
    case 3:
        FullDetailDistance = 1500.0f;
        SimplifiedDetailDistance = 4000.0f;
        BoundingBoxDistance = 8000.0f;
        CollisionCooldownFrames = 0;
        break;
    }
}

void UMT_CollisionOptimizer::ForceFullDetailForActor(AActor* Actor, float DurationSeconds)
{
    if (Actor && RegisteredObjects.Contains(Actor))
    {
        ForcedFullDetailActors.Add(Actor, DurationSeconds);
        ApplyDetailLevel(RegisteredObjects[Actor], ECollisionDetailLevel::CDL_Full);
    }
}

void UMT_CollisionOptimizer::ResetStatistics()
{
    CurrentStats.Reset();
    AccumulatedFrameTime = 0.0f;
    FrameCount = 0;
}

bool UMT_CollisionOptimizer::IsCollisionCooldownActive(AActor* Actor) const
{
    const FCollisionObjectInfo* Info = RegisteredObjects.Find(Actor);
    if (Info && bEnableCollisionCooldown)
    {
        int32 CurrentFrame = GFrameCounter;
        return (CurrentFrame - Info->LastCollisionFrame) < CollisionCooldownFrames;
    }
    return false;
}

ECollisionDetailLevel UMT_CollisionOptimizer::CalculateDetailLevel(const FCollisionObjectInfo& ObjectInfo) const
{
    if (ObjectInfo.bIsStatic)
    {
        return ECollisionDetailLevel::CDL_Simplified;
    }

    ECollisionDetailLevel DistanceLevel = ECollisionDetailLevel::CDL_Full;
    if (bEnableDistanceLOD)
    {
        if (ObjectInfo.DistanceFromCamera > BoundingBoxDistance)
        {
            DistanceLevel = ECollisionDetailLevel::CDL_Disabled;
        }
        else if (ObjectInfo.DistanceFromCamera > SimplifiedDetailDistance)
        {
            DistanceLevel = ECollisionDetailLevel::CDL_BoundingBox;
        }
        else if (ObjectInfo.DistanceFromCamera > FullDetailDistance)
        {
            DistanceLevel = ECollisionDetailLevel::CDL_Simplified;
        }
    }

    ECollisionDetailLevel ScreenSizeLevel = ECollisionDetailLevel::CDL_Full;
    if (bEnableScreenSizeLOD)
    {
        if (ObjectInfo.ScreenSizePercentage < 1.0f)
        {
            ScreenSizeLevel = ECollisionDetailLevel::CDL_Disabled;
        }
        else if (ObjectInfo.ScreenSizePercentage < MinScreenSizeForFullDetail / 2.0f)
        {
            ScreenSizeLevel = ECollisionDetailLevel::CDL_BoundingBox;
        }
        else if (ObjectInfo.ScreenSizePercentage < MinScreenSizeForFullDetail)
        {
            ScreenSizeLevel = ECollisionDetailLevel::CDL_Simplified;
        }
    }

    ECollisionDetailLevel VelocityLevel = ECollisionDetailLevel::CDL_Full;
    if (bEnableVelocityOptimization && ObjectInfo.VelocityMagnitude < HighVelocityThreshold * 0.1f)
    {
        VelocityLevel = ECollisionDetailLevel::CDL_Simplified;
    }

    ECollisionDetailLevel ResultLevel = FMath::Min(DistanceLevel, FMath::Min(ScreenSizeLevel, VelocityLevel));
    return ResultLevel;
}

void UMT_CollisionOptimizer::ApplyDetailLevel(FCollisionObjectInfo& ObjectInfo, ECollisionDetailLevel NewLevel)
{
    if (ObjectInfo.DetailLevel == NewLevel || !ObjectInfo.PrimitiveComponent)
    {
        return;
    }

    ObjectInfo.DetailLevel = NewLevel;

    switch (NewLevel)
    {
    case ECollisionDetailLevel::CDL_Full:
        ObjectInfo.PrimitiveComponent->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        break;
    case ECollisionDetailLevel::CDL_Simplified:
        ObjectInfo.PrimitiveComponent->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        break;
    case ECollisionDetailLevel::CDL_BoundingBox:
        ObjectInfo.PrimitiveComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
        break;
    case ECollisionDetailLevel::CDL_Disabled:
        ObjectInfo.PrimitiveComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        break;
    }

    OnCollisionDetailChanged.Broadcast(ObjectInfo.OwnerActor);
}

void UMT_CollisionOptimizer::UpdateObjectMetrics(FCollisionObjectInfo& ObjectInfo)
{
    if (!ObjectInfo.OwnerActor)
    {
        return;
    }

    APlayerCameraManager* CameraManager = UGameplayStatics::GetPlayerCameraManager(ObjectInfo.OwnerActor->GetWorld(), 0);
    if (CameraManager)
    {
        FVector CameraLocation = CameraManager->GetCameraLocation();
        ObjectInfo.DistanceFromCamera = FVector::Dist(CameraLocation, ObjectInfo.OwnerActor->GetActorLocation());
        ObjectInfo.ScreenSizePercentage = CalculateScreenSize(ObjectInfo);
    }

    if (ObjectInfo.PrimitiveComponent && ObjectInfo.PrimitiveComponent->IsSimulatingPhysics())
    {
        FVector Velocity = ObjectInfo.PrimitiveComponent->GetPhysicsLinearVelocity();
        ObjectInfo.VelocityMagnitude = Velocity.Size();
    }
    else
    {
        ObjectInfo.VelocityMagnitude = 0.0f;
    }
}

float UMT_CollisionOptimizer::CalculateScreenSize(const FCollisionObjectInfo& ObjectInfo) const
{
    if (!ObjectInfo.OwnerActor || !ObjectInfo.PrimitiveComponent)
    {
        return 0.0f;
    }

    FVector Origin, BoxExtent;
    ObjectInfo.OwnerActor->GetActorBounds(false, Origin, BoxExtent);

    float EstimatedScreenSize = (BoxExtent.Size() / FMath::Max(ObjectInfo.DistanceFromCamera, 1.0f)) * 100.0f;
    return EstimatedScreenSize;
}

bool UMT_CollisionOptimizer::ShouldSkipCollisionCheck(const FCollisionObjectInfo& ObjectInfo) const
{
    if (bEnableCollisionCooldown && !ObjectInfo.bIsStatic)
    {
        int32 CurrentFrame = GFrameCounter;
        if ((CurrentFrame - ObjectInfo.LastCollisionFrame) < CollisionCooldownFrames)
        {
            return true;
        }
    }

    if (bEnableVelocityOptimization && ObjectInfo.VelocityMagnitude < 1.0f && !ObjectInfo.bIsStatic)
    {
        return true;
    }

    return false;
}
