#pragma once

#include "CoreMinimal.h"
#include "MT_ResourceLoadManager.generated.h"

UENUM(BlueprintType)
enum class EResourcePriority : uint8
{
    RP_Critical UMETA(DisplayName = "立即加载"),
    RP_High UMETA(DisplayName = "高优先级"),
    RP_Medium UMETA(DisplayName = "中优先级"),
    RP_Low UMETA(DisplayName = "低优先级"),
    RP_Background UMETA(DisplayName = "后台加载")
};

UENUM(BlueprintType)
enum class ELoadState : uint8
{
    LS_NotLoaded UMETA(DisplayName = "未加载"),
    LS_Loading UMETA(DisplayName = "加载中"),
    LS_Loaded UMETA(DisplayName = "已加载"),
    LS_Failed UMETA(DisplayName = "加载失败")
};

USTRUCT(BlueprintType)
struct FResourceLoadRequest
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "资源加载")
    FString ResourcePath;

    UPROPERTY(BlueprintReadWrite, Category = "资源加载")
    EResourcePriority Priority;

    UPROPERTY(BlueprintReadWrite, Category = "资源加载")
    float TimeoutSeconds;

    UPROPERTY(BlueprintReadWrite, Category = "资源加载")
    bool bForceSynchronous;

    FResourceLoadRequest()
        : Priority(EResourcePriority::RP_Medium)
        , TimeoutSeconds(30.0f)
        , bForceSynchronous(false)
    {}
};

USTRUCT(BlueprintType)
struct FResourceLoadInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    FString ResourcePath;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    ELoadState LoadState;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    EResourcePriority Priority;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    float LoadProgress;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    float LoadStartTime;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    float LoadEndTime;

    UPROPERTY(BlueprintReadOnly, Category = "资源加载")
    int32 MemoryUsageKB;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnResourceLoaded, const FString&, ResourcePath);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLoadProgressUpdated, const FString&, ResourcePath, float, Progress);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnBatchLoadComplete, int32, TotalLoaded, int32, TotalFailed);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_ResourceLoadManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_ResourceLoadManager();

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void InitializeLoadManager();

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void LoadResourceByPriority(const FResourceLoadRequest& Request);

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void LoadResourceBatch(const TArray<FResourceLoadRequest>& Requests, bool bProcessInOrder = true);

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void CancelLoad(const FString& ResourcePath);

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void CancelAllLoads();

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    ELoadState GetResourceLoadState(const FString& ResourcePath) const;

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    float GetResourceLoadProgress(const FString& ResourcePath) const;

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    TArray<FResourceLoadInfo> GetAllLoadingResources() const;

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void UnloadUnusedResources(float UnloadDelaySeconds = 10.0f);

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void SetMaxConcurrentLoads(int32 MaxLoads);

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    int32 GetTotalMemoryUsageKB() const;

    UFUNCTION(BlueprintCallable, Category = "资源加载")
    void EnableBackgroundLoading(bool bEnable);

    UPROPERTY(BlueprintAssignable, Category = "资源加载事件")
    FOnResourceLoaded OnResourceLoaded;

    UPROPERTY(BlueprintAssignable, Category = "资源加载事件")
    FOnLoadProgressUpdated OnLoadProgressUpdated;

    UPROPERTY(BlueprintAssignable, Category = "资源加载事件")
    FOnBatchLoadComplete OnBatchLoadComplete;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    int32 MaxConcurrentCriticalLoads;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    int32 MaxConcurrentHighPriorityLoads;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    int32 MaxConcurrentMediumPriorityLoads;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    int32 MaxConcurrentLowPriorityLoads;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    bool bEnableBackgroundLoading;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "资源加载设置")
    float BackgroundLoadInterval;

private:
    struct FActiveLoad
    {
        FString ResourcePath;
        EResourcePriority Priority;
        float StartTime;
        float Progress;
        bool bIsLoading;
    };

    TMap<FString, FResourceLoadInfo> LoadedResources;
    TArray<FActiveLoad> ActiveLoads;
    TArray<FResourceLoadRequest> PendingRequests;

    int32 CurrentCriticalLoads;
    int32 CurrentHighPriorityLoads;
    int32 CurrentMediumPriorityLoads;
    int32 CurrentLowPriorityLoads;

    float LastBackgroundLoadTime;

    void ProcessPendingRequests();
    void StartLoadingResource(const FResourceLoadRequest& Request);
    void UpdateLoadProgress(const FString& ResourcePath, float NewProgress);
    void CompleteLoad(const FString& ResourcePath, bool bSuccess);
    int32 GetMaxLoadsForPriority(EResourcePriority Priority) const;
    int32 GetCurrentLoadsForPriority(EResourcePriority Priority) const;
    bool CanStartNewLoad(EResourcePriority Priority) const;
    void GarbageCollectResources();

    FTimerHandle ResourceUpdateTimerHandle;
    FTimerHandle GarbageCollectionTimerHandle;
};
