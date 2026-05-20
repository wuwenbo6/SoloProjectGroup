#include "UI/MT_UIPerformanceManager.h"
#include "Blueprint/UserWidget.h"
#include "Components/WidgetComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/CameraActor.h"

UMT_UIPerformanceManager::UMT_UIPerformanceManager()
{
    CurrentPerformanceLevel = EUIPerformanceLevel::UPL_High;
    CurrentScaleFactor = 1.0f;
    AccumulatedFrameTime = 0.0f;
    FrameCount = 0;
    LastQualityAdjustmentTime = 0.0f;
    bProfilingEnabled = false;
    bAdaptiveQualityEnabled = true;

    bEnableWidgetCulling = true;
    CullingDistanceThreshold = 1500.0f;
    bEnableDrawCallBatching = true;
    bEnableTextureStreaming = true;
    bEnableTickOptimization = true;
    bEnableLODForWidgets = true;

    LowFPSScaleFactor = 0.8f;
    HighFPSScaleFactor = 1.0f;
    TargetFPS = 60;
    QualityAdjustmentInterval = 2.0f;

    PerformanceStats.Reset();
}

void UMT_UIPerformanceManager::InitializeUIPerformanceManager()
{
    PerformanceStats.Reset();
    ApplyPerformanceLevelSettings(CurrentPerformanceLevel);
}

void UMT_UIPerformanceManager::RegisterWidgetForPerformanceTracking(UUserWidget* Widget)
{
    if (!Widget || WidgetPerformanceMap.Contains(Widget))
    {
        return;
    }

    FUIWidgetPerformanceData Data;
    Data.WidgetName = Widget->GetName();
    Data.bIsVisible = Widget->IsVisible();

    WidgetPerformanceMap.Add(Widget, Data);
    PerformanceStats.TotalWidgetCount++;
}

void UMT_UIPerformanceManager::UnregisterWidget(UUserWidget* Widget)
{
    if (WidgetPerformanceMap.Contains(Widget))
    {
        WidgetPerformanceMap.Remove(Widget);
        PerformanceStats.TotalWidgetCount--;
    }
}

void UMT_UIPerformanceManager::UpdateUIPerformance(float DeltaTime)
{
    double StartTime = FPlatformTime::Seconds();

    UpdateFrameTimeMetrics(DeltaTime);

    if (bAdaptiveQualityEnabled)
    {
        AdjustQualityIfNeeded();
    }

    int32 VisibleCount = 0;

    for (auto& Pair : WidgetPerformanceMap)
    {
        UUserWidget* Widget = Pair.Key;
        FUIWidgetPerformanceData& Data = Pair.Value;

        if (!IsValid(Widget))
        {
            continue;
        }

        Data.bIsVisible = Widget->IsVisible();
        if (Data.bIsVisible)
        {
            VisibleCount++;
        }

        if (bEnableWidgetCulling && ShouldCullWidget(Widget))
        {
            if (Data.bIsVisible)
            {
                Widget->SetVisibility(ESlateVisibility::Hidden);
                Data.bIsOffscreen = true;
                PerformanceStats.WidgetsCulled++;
                OnWidgetCulled.Broadcast(Data.WidgetName);
            }
        }
        else if (Data.bIsOffscreen)
        {
            Widget->SetVisibility(ESlateVisibility::Visible);
            Data.bIsOffscreen = false;
        }

        if (bEnableTickOptimization && !Data.bIsOffscreen)
        {
            UpdateWidgetTickFrequency(Widget, CurrentPerformanceLevel);
        }

        if (bEnableLODForWidgets)
        {
            OptimizeWidgetRendering(Widget, CurrentPerformanceLevel);
        }

        if (bProfilingEnabled)
        {
            Data.TickCount++;
        }
    }

    PerformanceStats.VisibleWidgetCount = VisibleCount;

    double EndTime = FPlatformTime::Seconds();
    PerformanceStats.TotalUITimeMs = (EndTime - StartTime) * 1000.0f;
}

void UMT_UIPerformanceManager::SetPerformanceLevel(EUIPerformanceLevel NewLevel)
{
    if (CurrentPerformanceLevel != NewLevel)
    {
        CurrentPerformanceLevel = NewLevel;
        ApplyPerformanceLevelSettings(NewLevel);
        OnPerformanceLevelChanged.Broadcast(NewLevel);
    }
}

TArray<FUIWidgetPerformanceData> UMT_UIPerformanceManager::GetAllWidgetPerformanceData() const
{
    TArray<FUIWidgetPerformanceData> Result;
    WidgetPerformanceMap.GenerateValueArray(Result);
    return Result;
}

void UMT_UIPerformanceManager::EnablePerformanceProfiling(bool bEnable)
{
    bProfilingEnabled = bEnable;
}

void UMT_UIPerformanceManager::ForceWidgetQuality(UUserWidget* Widget, int32 QualityLevel)
{
    if (!Widget)
    {
        return;
    }

    EUIPerformanceLevel Level = static_cast<EUIPerformanceLevel>(FMath::Clamp(QualityLevel, 0, 4));
    OptimizeWidgetRendering(Widget, Level);
}

void UMT_UIPerformanceManager::SetUIScaleFactor(float ScaleFactor)
{
    CurrentScaleFactor = FMath::Clamp(ScaleFactor, 0.5f, 2.0f);
}

void UMT_UIPerformanceManager::SetMaxFrameRate(int32 MaxFPS)
{
    TargetFPS = FMath::Clamp(MaxFPS, 15, 120);
}

void UMT_UIPerformanceManager::EnableAdaptiveQuality(bool bEnable)
{
    bAdaptiveQualityEnabled = bEnable;
}

void UMT_UIPerformanceManager::ApplyPerformanceLevelSettings(EUIPerformanceLevel Level)
{
    switch (Level)
    {
    case EUIPerformanceLevel::UPL_Ultra:
        CurrentScaleFactor = 1.0f;
        bEnableWidgetCulling = false;
        bEnableTickOptimization = false;
        bEnableLODForWidgets = false;
        break;
    case EUIPerformanceLevel::UPL_High:
        CurrentScaleFactor = 1.0f;
        bEnableWidgetCulling = true;
        CullingDistanceThreshold = 2000.0f;
        bEnableTickOptimization = true;
        bEnableLODForWidgets = true;
        break;
    case EUIPerformanceLevel::UPL_Medium:
        CurrentScaleFactor = 0.9f;
        bEnableWidgetCulling = true;
        CullingDistanceThreshold = 1500.0f;
        bEnableTickOptimization = true;
        bEnableLODForWidgets = true;
        break;
    case EUIPerformanceLevel::UPL_Low:
        CurrentScaleFactor = 0.75f;
        bEnableWidgetCulling = true;
        CullingDistanceThreshold = 1000.0f;
        bEnableTickOptimization = true;
        bEnableLODForWidgets = true;
        break;
    case EUIPerformanceLevel::UPL_PowerSaving:
        CurrentScaleFactor = 0.6f;
        bEnableWidgetCulling = true;
        CullingDistanceThreshold = 800.0f;
        bEnableTickOptimization = true;
        bEnableLODForWidgets = true;
        TargetFPS = 30;
        break;
    }
}

bool UMT_UIPerformanceManager::ShouldCullWidget(UUserWidget* Widget) const
{
    if (!Widget || !Widget->GetParent())
    {
        return false;
    }

    UWidgetComponent* WidgetComp = Cast<UWidgetComponent>(Widget->GetParent());
    if (WidgetComp)
    {
        APlayerCameraManager* CameraManager = UGameplayStatics::GetPlayerCameraManager(Widget->GetWorld(), 0);
        if (CameraManager)
        {
            float Distance = FVector::Dist(CameraManager->GetCameraLocation(), WidgetComp->GetComponentLocation());
            return Distance > CullingDistanceThreshold;
        }
    }

    return false;
}

void UMT_UIPerformanceManager::UpdateWidgetTickFrequency(UUserWidget* Widget, EUIPerformanceLevel Level)
{
    if (!Widget)
    {
        return;
    }

    float TickInterval = 0.0f;
    switch (Level)
    {
    case EUIPerformanceLevel::UPL_Ultra:
        TickInterval = 0.0f;
        break;
    case EUIPerformanceLevel::UPL_High:
        TickInterval = 0.016f;
        break;
    case EUIPerformanceLevel::UPL_Medium:
        TickInterval = 0.033f;
        break;
    case EUIPerformanceLevel::UPL_Low:
        TickInterval = 0.05f;
        break;
    case EUIPerformanceLevel::UPL_PowerSaving:
        TickInterval = 0.1f;
        break;
    }

    Widget->SetTickInterval(TickInterval);
}

void UMT_UIPerformanceManager::OptimizeWidgetRendering(UUserWidget* Widget, EUIPerformanceLevel Level)
{
    if (!Widget)
    {
        return;
    }

    float RenderQuality = 1.0f;
    switch (Level)
    {
    case EUIPerformanceLevel::UPL_Ultra:
        RenderQuality = 1.0f;
        break;
    case EUIPerformanceLevel::UPL_High:
        RenderQuality = 0.9f;
        break;
    case EUIPerformanceLevel::UPL_Medium:
        RenderQuality = 0.75f;
        break;
    case EUIPerformanceLevel::UPL_Low:
        RenderQuality = 0.6f;
        break;
    case EUIPerformanceLevel::UPL_PowerSaving:
        RenderQuality = 0.5f;
        break;
    }

    if (RenderQuality != 1.0f)
    {
        Widget->SetRenderTranslation(FVector2D::ZeroVector);
        Widget->SetRenderScale(FVector2D(RenderQuality, RenderQuality));
    }
    else
    {
        Widget->SetRenderScale(FVector2D(1.0f, 1.0f));
    }
}

float UMT_UIPerformanceManager::CalculateWidgetCost(UUserWidget* Widget) const
{
    if (!Widget)
    {
        return 0.0f;
    }

    return 1.0f;
}

void UMT_UIPerformanceManager::UpdateFrameTimeMetrics(float DeltaTime)
{
    AccumulatedFrameTime += DeltaTime;
    FrameCount++;

    if (FrameCount > 0)
    {
        float AvgFrameTime = AccumulatedFrameTime / FrameCount;
        PerformanceStats.AverageFrameTimeMs = AvgFrameTime * 1000.0f;
        PerformanceStats.CurrentFPS = 1.0f / AvgFrameTime;

        if (FrameCount > 100)
        {
            AccumulatedFrameTime = AvgFrameTime * 50;
            FrameCount = 50;
        }
    }
}

void UMT_UIPerformanceManager::AdjustQualityIfNeeded()
{
    float CurrentTime = AccumulatedFrameTime;
    if (CurrentTime - LastQualityAdjustmentTime < QualityAdjustmentInterval)
    {
        return;
    }

    LastQualityAdjustmentTime = CurrentTime;

    float CurrentFPS = PerformanceStats.CurrentFPS;
    if (CurrentFPS <= 0.0f)
    {
        return;
    }

    int32 CurrentLevelIndex = static_cast<int32>(CurrentPerformanceLevel);

    if (CurrentFPS < TargetFPS * 0.7f && CurrentLevelIndex < 4)
    {
        SetPerformanceLevel(static_cast<EUIPerformanceLevel>(CurrentLevelIndex + 1));
    }
    else if (CurrentFPS > TargetFPS * 1.1f && CurrentLevelIndex > 0)
    {
        SetPerformanceLevel(static_cast<EUIPerformanceLevel>(CurrentLevelIndex - 1));
    }
}

void UMT_UIPerformanceManager::LogWidgetPerformance(UUserWidget* Widget, float RenderTime)
{
    if (!bProfilingEnabled || !Widget)
    {
        return;
    }

    FUIWidgetPerformanceData* Data = WidgetPerformanceMap.Find(Widget);
    if (Data)
    {
        Data->LastRenderTimeMs = RenderTime;
        Data->UpdateCount++;
        Data->AverageRenderTimeMs = (Data->AverageRenderTimeMs * (Data->UpdateCount - 1) + RenderTime) / Data->UpdateCount;
    }
}
