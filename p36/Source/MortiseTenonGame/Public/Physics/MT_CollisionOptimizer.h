#pragma once

#include "CoreMinimal.h"
#include "MT_CollisionOptimizer.generated.h"

UENUM(BlueprintType)
enum class ECollisionDetailLevel : uint8
{
    CDL_Full UMETA(DisplayName = "完整检测"),
    CDL_Simplified UMETA(DisplayName = "简化检测"),
    CDL_BoundingBox UMETA(DisplayName = "包围盒检测"),
    CDL_Disabled UMETA(DisplayName = "禁用检测")
};

USTRUCT(BlueprintType)
struct FCollisionObjectInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    AActor* OwnerActor;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    UPrimitiveComponent* PrimitiveComponent;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    ECollisionDetailLevel DetailLevel;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    float DistanceFromCamera;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    float ScreenSizePercentage;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    float VelocityMagnitude;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    bool bIsStatic;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞优化")
    int32 LastCollisionFrame;

    FCollisionObjectInfo()
        : OwnerActor(nullptr)
        , PrimitiveComponent(nullptr)
        , DetailLevel(ECollisionDetailLevel::CDL_Full)
        , DistanceFromCamera(0.0f)
        , ScreenSizePercentage(0.0f)
        , VelocityMagnitude(0.0f)
        , bIsStatic(false)
        , LastCollisionFrame(0)
    {}
};

USTRUCT(BlueprintType)
struct FCollisionPerformanceStats
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    int32 TotalCollisionChecks;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    int32 FullDetailChecks;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    int32 SimplifiedChecks;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    int32 BoundingBoxChecks;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    int32 SkippedChecks;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    float AverageCollisionTimeMs;

    UPROPERTY(BlueprintReadOnly, Category = "碰撞统计")
    float PeakCollisionTimeMs;

    void Reset()
    {
        TotalCollisionChecks = 0;
        FullDetailChecks = 0;
        SimplifiedChecks = 0;
        BoundingBoxChecks = 0;
        SkippedChecks = 0;
        AverageCollisionTimeMs = 0.0f;
        PeakCollisionTimeMs = 0.0f;
    }
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnCollisionDetailChanged, AActor*, AffectedActor);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPerformanceWarning, float, FrameTimeMs);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_CollisionOptimizer : public UObject
{
    GENERATED_BODY()

public:
    UMT_CollisionOptimizer();

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void InitializeOptimizer();

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void RegisterActorForOptimization(AActor* Actor);

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void UnregisterActor(AActor* Actor);

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void UpdateCollisionOptimizations(float DeltaTime);

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void SetOptimizationLevel(int32 Level);

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void ForceFullDetailForActor(AActor* Actor, float DurationSeconds = 5.0f);

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    FCollisionPerformanceStats GetPerformanceStats() const { return CurrentStats; }

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    void ResetStatistics();

    UFUNCTION(BlueprintCallable, Category = "碰撞优化")
    bool IsCollisionCooldownActive(AActor* Actor) const;

    UPROPERTY(BlueprintAssignable, Category = "碰撞优化事件")
    FOnCollisionDetailChanged OnCollisionDetailChanged;

    UPROPERTY(BlueprintAssignable, Category = "碰撞优化事件")
    FOnPerformanceWarning OnPerformanceWarning;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float FullDetailDistance;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float SimplifiedDetailDistance;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float BoundingBoxDistance;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float MinScreenSizeForFullDetail;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float HighVelocityThreshold;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    int32 CollisionCooldownFrames;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    bool bEnableDistanceLOD;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    bool bEnableScreenSizeLOD;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    bool bEnableVelocityOptimization;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    bool bEnableCollisionCooldown;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "碰撞优化设置")
    float PerformanceWarningThresholdMs;

private:
    TMap<AActor*, FCollisionObjectInfo> RegisteredObjects;
    FCollisionPerformanceStats CurrentStats;

    TMap<AActor*, float> ForcedFullDetailActors;

    ECollisionDetailLevel CalculateDetailLevel(const FCollisionObjectInfo& ObjectInfo) const;
    void ApplyDetailLevel(FCollisionObjectInfo& ObjectInfo, ECollisionDetailLevel NewLevel);
    void UpdateObjectMetrics(FCollisionObjectInfo& ObjectInfo);
    float CalculateScreenSize(const FCollisionObjectInfo& ObjectInfo) const;
    bool ShouldSkipCollisionCheck(const FCollisionObjectInfo& ObjectInfo) const;

    int32 CurrentOptimizationLevel;
    float AccumulatedFrameTime;
    int32 FrameCount;
};
