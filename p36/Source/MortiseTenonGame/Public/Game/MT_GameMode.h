#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "MT_GameMode.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLevelCompleted, int32, LevelID);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPartSnapped, AMT_MortiseTenonPart*, SnappedPart);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnAllPartsPlaced);

UENUM(BlueprintType)
enum class EGameState : uint8
{
    GS_Menu UMETA(DisplayName = "菜单"),
    GS_LevelSelect UMETA(DisplayName = "关卡选择"),
    GS_Playing UMETA(DisplayName = "游戏中"),
    GS_Paused UMETA(DisplayName = "暂停"),
    GS_Completed UMETA(DisplayName = "完成"),
    GS_Education UMETA(DisplayName = "教育模式")
};

UCLASS()
class MORTISETENONGAME_API AMT_GameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AMT_GameMode();

    virtual void BeginPlay() override;

    virtual void Tick(float DeltaTime) override;

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void StartLevel(int32 LevelID);

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void RestartLevel();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void CompleteLevel();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void PauseGame();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void ResumeGame();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void ReturnToMenu();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void SelectPart(AMT_MortiseTenonPart* Part);

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void DeselectCurrentPart();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void MoveSelectedPart(const FVector& Delta);

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void RotateSelectedPart(const FRotator& Delta);

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void PlaceSelectedPart();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    AMT_MortiseTenonPart* GetSelectedPart() const { return SelectedPart; }

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    TArray<AMT_MortiseTenonPart*> GetAllParts() const { return SpawnedParts; }

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    int32 GetCurrentLevelID() const { return CurrentLevelID; }

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    EGameState GetCurrentGameState() const { return CurrentGameState; }

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    float GetLevelProgress() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void ShowHint();

    UFUNCTION(BlueprintCallable, Category = "榫卯游戏")
    void HideHint();

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnLevelCompleted OnLevelCompleted;

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnPartSnapped OnPartSnapped;

    UPROPERTY(BlueprintAssignable, Category = "榫卯事件")
    FOnAllPartsPlaced OnAllPartsPlaced;

protected:
    UPROPERTY(EditAnywhere, Category = "榫卯游戏")
    TSubclassOf<class AMT_LevelData> LevelDataClass;

    UPROPERTY(EditAnywhere, Category = "榫卯游戏")
    int32 CurrentLevelID;

private:
    void SpawnLevelParts();
    void CheckLevelCompletion();
    void OnPartSnappedCallback(UMT_PhysicsInteractionComponent* SnappedComponent);
    void CleanupPreviousLevel();
    void SpawnNextPart();
    void FinishLevelLoading();

    EGameState CurrentGameState;
    AMT_MortiseTenonPart* SelectedPart;
    TArray<AMT_MortiseTenonPart*> SpawnedParts;
    TArray<FPartSpawnData> PendingSpawnData;
    int32 CurrentSpawnIndex;
    int32 SnappedPartsCount;
    bool bIsPaused;
    bool bIsLoadingLevel;
    FTimerHandle SpawnTimerHandle;
};
