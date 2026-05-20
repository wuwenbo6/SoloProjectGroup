#pragma once

#include "CoreMinimal.h"
#include "MT_UIPerformanceManager.generated.h"

UENUM(BlueprintType)
enum class EUIPerformanceLevel : uint8
{
    UPL_Ultra UMETA(DisplayName = "极致"),
    UPL_High UMETA(DisplayName = "高"),
    UPL_Medium UMETA(DisplayName = "中"),
    UPL_Low UMETA(DisplayName = "低"),
    UPL_PowerSaving UMETA(DisplayName = "省电")
};

USTRUCT(BlueprintType)
struct FUIWidgetPerformanceData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    FString WidgetName;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float LastRenderTimeMs;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float AverageRenderTimeMs;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 UpdateCount;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 TickCount;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    bool bIsVisible;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    bool bIsOffscreen;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float DistanceFromCenter;

    FUIWidgetPerformanceData()
        : LastRenderTimeMs(0.0f)
        , AverageRenderTimeMs(0.0f)
        , UpdateCount(0)
        , TickCount(0)
        , bIsVisible(false)
        , bIsOffscreen(false)
        , DistanceFromCenter(0.0f)
    {}
};

USTRUCT(BlueprintType)
struct FUIPerformanceStats
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float TotalUITimeMs;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float AverageFrameTimeMs;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 VisibleWidgetCount;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 TotalWidgetCount;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 WidgetsCulled;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    int32 DrawCallsReduced;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float CurrentFPS;

    UPROPERTY(BlueprintReadOnly, Category = "UI性能")
    float MemoryUsageMB;

    void Reset()
    {
        TotalUITimeMs = 0.0f;
        AverageFrameTimeMs = 0.0f;
        VisibleWidgetCount = 0;
        TotalWidgetCount = 0;
        WidgetsCulled = 0;
        DrawCallsReduced = 0;
        CurrentFPS = 0.0f;
        MemoryUsageMB = 0.0f;
    }
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPerformanceLevelChanged, EUIPerformanceLevel, NewLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWidgetCulled, FString, WidgetName);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_UIPerformanceManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_UIPerformanceManager();

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void InitializeUIPerformanceManager();

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void RegisterWidgetForPerformanceTracking(UUserWidget* Widget);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void UnregisterWidget(UUserWidget* Widget);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void UpdateUIPerformance(float DeltaTime);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void SetPerformanceLevel(EUIPerformanceLevel NewLevel);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    EUIPerformanceLevel GetCurrentPerformanceLevel() const { return CurrentPerformanceLevel; }

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    FUIPerformanceStats GetPerformanceStats() const { return PerformanceStats; }

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    TArray<FUIWidgetPerformanceData> GetAllWidgetPerformanceData() const;

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void EnablePerformanceProfiling(bool bEnable);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void ForceWidgetQuality(UUserWidget* Widget, int32 QualityLevel);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void SetUIScaleFactor(float ScaleFactor);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    float GetUIScaleFactor() const { return CurrentScaleFactor; }

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void SetMaxFrameRate(int32 MaxFPS);

    UFUNCTION(BlueprintCallable, Category = "UI性能")
    void EnableAdaptiveQuality(bool bEnable);

    UPROPERTY(BlueprintAssignable, Category = "UI性能事件")
    FOnPerformanceLevelChanged OnPerformanceLevelChanged;

    UPROPERTY(BlueprintAssignable, Category = "UI性能事件")
    FOnWidgetCulled OnWidgetCulled;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    bool bEnableWidgetCulling;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    float CullingDistanceThreshold;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    bool bEnableDrawCallBatching;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    bool bEnableTextureStreaming;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    bool bEnableTickOptimization;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    bool bEnableLODForWidgets;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    float LowFPSScaleFactor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    float HighFPSScaleFactor;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    int32 TargetFPS;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UI性能设置")
    float QualityAdjustmentInterval;

private:
    TMap<UUserWidget*, FUIWidgetPerformanceData> WidgetPerformanceMap;
    FUIPerformanceStats PerformanceStats;
    EUIPerformanceLevel CurrentPerformanceLevel;

    float CurrentScaleFactor;
    float AccumulatedFrameTime;
    int32 FrameCount;
    float LastQualityAdjustmentTime;
    bool bProfilingEnabled;
    bool bAdaptiveQualityEnabled;

    void ApplyPerformanceLevelSettings(EUIPerformanceLevel Level);
    bool ShouldCullWidget(UUserWidget* Widget) const;
    void UpdateWidgetTickFrequency(UUserWidget* Widget, EUIPerformanceLevel Level);
    void OptimizeWidgetRendering(UUserWidget* Widget, EUIPerformanceLevel Level);
    float CalculateWidgetCost(UUserWidget* Widget) const;
    void UpdateFrameTimeMetrics(float DeltaTime);
    void AdjustQualityIfNeeded();
    void LogWidgetPerformance(UUserWidget* Widget, float RenderTime);
};
