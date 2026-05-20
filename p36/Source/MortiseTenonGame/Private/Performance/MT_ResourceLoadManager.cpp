#include "Performance/MT_ResourceLoadManager.h"

UMT_ResourceLoadManager::UMT_ResourceLoadManager()
{
    MaxConcurrentCriticalLoads = 3;
    MaxConcurrentHighPriorityLoads = 5;
    MaxConcurrentMediumPriorityLoads = 8;
    MaxConcurrentLowPriorityLoads = 10;
    bEnableBackgroundLoading = true;
    BackgroundLoadInterval = 0.5f;

    CurrentCriticalLoads = 0;
    CurrentHighPriorityLoads = 0;
    CurrentMediumPriorityLoads = 0;
    CurrentLowPriorityLoads = 0;
    LastBackgroundLoadTime = 0.0f;
}

void UMT_ResourceLoadManager::InitializeLoadManager()
{
}

void UMT_ResourceLoadManager::LoadResourceByPriority(const FResourceLoadRequest& Request)
{
    PendingRequests.Add(Request);
    ProcessPendingRequests();
}

void UMT_ResourceLoadManager::LoadResourceBatch(const TArray<FResourceLoadRequest>& Requests, bool bProcessInOrder)
{
    if (bProcessInOrder)
    {
        for (const FResourceLoadRequest& Request : Requests)
        {
            PendingRequests.Add(Request);
        }
    }
    else
    {
        PendingRequests.Append(Requests);
    }
    ProcessPendingRequests();
}

void UMT_ResourceLoadManager::CancelLoad(const FString& ResourcePath)
{
    for (int32 i = PendingRequests.Num() - 1; i >= 0; --i)
    {
        if (PendingRequests[i].ResourcePath == ResourcePath)
        {
            PendingRequests.RemoveAt(i);
        }
    }

    for (int32 i = ActiveLoads.Num() - 1; i >= 0; --i)
    {
        if (ActiveLoads[i].ResourcePath == ResourcePath)
        {
            ActiveLoads.RemoveAt(i);
            if (LoadedResources.Contains(ResourcePath))
            {
                LoadedResources[ResourcePath].LoadState = ELoadState::LS_NotLoaded;
            }
        }
    }
}

void UMT_ResourceLoadManager::CancelAllLoads()
{
    PendingRequests.Empty();
    ActiveLoads.Empty();
}

ELoadState UMT_ResourceLoadManager::GetResourceLoadState(const FString& ResourcePath) const
{
    const FResourceLoadInfo* Info = LoadedResources.Find(ResourcePath);
    if (Info)
    {
        return Info->LoadState;
    }
    return ELoadState::LS_NotLoaded;
}

float UMT_ResourceLoadManager::GetResourceLoadProgress(const FString& ResourcePath) const
{
    const FResourceLoadInfo* Info = LoadedResources.Find(ResourcePath);
    if (Info)
    {
        return Info->LoadProgress;
    }
    return 0.0f;
}

TArray<FResourceLoadInfo> UMT_ResourceLoadManager::GetAllLoadingResources() const
{
    TArray<FResourceLoadInfo> Result;
    for (const auto& Pair : LoadedResources)
    {
        if (Pair.Value.LoadState == ELoadState::LS_Loading)
        {
            Result.Add(Pair.Value);
        }
    }
    return Result;
}

void UMT_ResourceLoadManager::UnloadUnusedResources(float UnloadDelaySeconds)
{
}

void UMT_ResourceLoadManager::SetMaxConcurrentLoads(int32 MaxLoads)
{
    MaxConcurrentCriticalLoads = FMath::Max(1, MaxLoads / 4);
    MaxConcurrentHighPriorityLoads = FMath::Max(2, MaxLoads / 3);
    MaxConcurrentMediumPriorityLoads = FMath::Max(3, MaxLoads / 2);
    MaxConcurrentLowPriorityLoads = MaxLoads;
}

int32 UMT_ResourceLoadManager::GetTotalMemoryUsageKB() const
{
    int32 Total = 0;
    for (const auto& Pair : LoadedResources)
    {
        if (Pair.Value.LoadState == ELoadState::LS_Loaded)
        {
            Total += Pair.Value.MemoryUsageKB;
        }
    }
    return Total;
}

void UMT_ResourceLoadManager::EnableBackgroundLoading(bool bEnable)
{
    bEnableBackgroundLoading = bEnable;
}

void UMT_ResourceLoadManager::ProcessPendingRequests()
{
    PendingRequests.Sort([](const FResourceLoadRequest& A, const FResourceLoadRequest& B)
    {
        return static_cast<uint8>(A.Priority) < static_cast<uint8>(B.Priority);
    });

    for (int32 i = 0; i < PendingRequests.Num(); ++i)
    {
        const FResourceLoadRequest& Request = PendingRequests[i];

        if (LoadedResources.Contains(Request.ResourcePath) &&
            LoadedResources[Request.ResourcePath].LoadState != ELoadState::LS_NotLoaded)
        {
            PendingRequests.RemoveAt(i);
            --i;
            continue;
        }

        if (CanStartNewLoad(Request.Priority))
        {
            StartLoadingResource(Request);
            PendingRequests.RemoveAt(i);
            --i;
        }
    }
}

void UMT_ResourceLoadManager::StartLoadingResource(const FResourceLoadRequest& Request)
{
    FResourceLoadInfo LoadInfo;
    LoadInfo.ResourcePath = Request.ResourcePath;
    LoadInfo.LoadState = ELoadState::LS_Loading;
    LoadInfo.Priority = Request.Priority;
    LoadInfo.LoadProgress = 0.0f;
    LoadInfo.LoadStartTime = FPlatformTime::Seconds();
    LoadInfo.MemoryUsageKB = 0;

    LoadedResources.Add(Request.ResourcePath, LoadInfo);

    FActiveLoad ActiveLoad;
    ActiveLoad.ResourcePath = Request.ResourcePath;
    ActiveLoad.Priority = Request.Priority;
    ActiveLoad.StartTime = LoadInfo.LoadStartTime;
    ActiveLoad.Progress = 0.0f;
    ActiveLoad.bIsLoading = true;
    ActiveLoads.Add(ActiveLoad);

    switch (Request.Priority)
    {
    case EResourcePriority::RP_Critical:
        CurrentCriticalLoads++;
        break;
    case EResourcePriority::RP_High:
        CurrentHighPriorityLoads++;
        break;
    case EResourcePriority::RP_Medium:
        CurrentMediumPriorityLoads++;
        break;
    case EResourcePriority::RP_Low:
    case EResourcePriority::RP_Background:
        CurrentLowPriorityLoads++;
        break;
    }

    float SimulatedLoadTime = 0.5f + FMath::RandRange(0.0f, 2.0f);
    if (Request.Priority == EResourcePriority::RP_Background)
    {
        SimulatedLoadTime *= 3.0f;
    }

    UpdateLoadProgress(Request.ResourcePath, 1.0f);
    CompleteLoad(Request.ResourcePath, true);
}

void UMT_ResourceLoadManager::UpdateLoadProgress(const FString& ResourcePath, float NewProgress)
{
    if (FResourceLoadInfo* Info = LoadedResources.Find(ResourcePath))
    {
        Info->LoadProgress = NewProgress;
        OnLoadProgressUpdated.Broadcast(ResourcePath, NewProgress);
    }
}

void UMT_ResourceLoadManager::CompleteLoad(const FString& ResourcePath, bool bSuccess)
{
    if (FResourceLoadInfo* Info = LoadedResources.Find(ResourcePath))
    {
        Info->LoadState = bSuccess ? ELoadState::LS_Loaded : ELoadState::LS_Failed;
        Info->LoadEndTime = FPlatformTime::Seconds();
        Info->LoadProgress = bSuccess ? 1.0f : 0.0f;
        Info->MemoryUsageKB = FMath::RandRange(100, 5000);

        for (int32 i = ActiveLoads.Num() - 1; i >= 0; --i)
        {
            if (ActiveLoads[i].ResourcePath == ResourcePath)
            {
                switch (ActiveLoads[i].Priority)
                {
                case EResourcePriority::RP_Critical:
                    CurrentCriticalLoads--;
                    break;
                case EResourcePriority::RP_High:
                    CurrentHighPriorityLoads--;
                    break;
                case EResourcePriority::RP_Medium:
                    CurrentMediumPriorityLoads--;
                    break;
                case EResourcePriority::RP_Low:
                case EResourcePriority::RP_Background:
                    CurrentLowPriorityLoads--;
                    break;
                }
                ActiveLoads.RemoveAt(i);
                break;
            }
        }

        if (bSuccess)
        {
            OnResourceLoaded.Broadcast(ResourcePath);
        }

        ProcessPendingRequests();
    }
}

int32 UMT_ResourceLoadManager::GetMaxLoadsForPriority(EResourcePriority Priority) const
{
    switch (Priority)
    {
    case EResourcePriority::RP_Critical:
        return MaxConcurrentCriticalLoads;
    case EResourcePriority::RP_High:
        return MaxConcurrentHighPriorityLoads;
    case EResourcePriority::RP_Medium:
        return MaxConcurrentMediumPriorityLoads;
    case EResourcePriority::RP_Low:
    case EResourcePriority::RP_Background:
        return MaxConcurrentLowPriorityLoads;
    default:
        return 5;
    }
}

int32 UMT_ResourceLoadManager::GetCurrentLoadsForPriority(EResourcePriority Priority) const
{
    switch (Priority)
    {
    case EResourcePriority::RP_Critical:
        return CurrentCriticalLoads;
    case EResourcePriority::RP_High:
        return CurrentHighPriorityLoads;
    case EResourcePriority::RP_Medium:
        return CurrentMediumPriorityLoads;
    case EResourcePriority::RP_Low:
    case EResourcePriority::RP_Background:
        return CurrentLowPriorityLoads;
    default:
        return 0;
    }
}

bool UMT_ResourceLoadManager::CanStartNewLoad(EResourcePriority Priority) const
{
    return GetCurrentLoadsForPriority(Priority) < GetMaxLoadsForPriority(Priority);
}

void UMT_ResourceLoadManager::GarbageCollectResources()
{
}
