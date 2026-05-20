#pragma once

#include "CoreMinimal.h"
#include "MT_SaveGame.h"
#include "MT_SaveManager.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSaveCompleted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnLoadCompleted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSaveFailed);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnLoadFailed);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_SaveManager : public UObject
{
    GENERATED_BODY()

public:
    UMT_SaveManager();

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    static UMT_SaveManager* GetInstance();

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool SaveGame(const FString& SlotName = TEXT("MortiseTenonSave"));

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool LoadGame(const FString& SlotName = TEXT("MortiseTenonSave"));

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool DoesSaveExist(const FString& SlotName = TEXT("MortiseTenonSave"));

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void DeleteSave(const FString& SlotName = TEXT("MortiseTenonSave"));

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void UpdateLevelProgress(int32 LevelID, bool bCompleted, float Time, int32 Stars);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void SaveCurrentLevelState(int32 LevelID, const TArray<class AMT_MortiseTenonPart*>& Parts, float PlayTime);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    TArray<FPartSaveData> LoadLevelState(int32 LevelID) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void UnlockLevel(int32 LevelID);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void AddAchievement(const FString& AchievementID);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void SetCurrentLevel(int32 LevelID);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void SetPlayerName(const FString& Name);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void SetHasSeenTutorial(bool bSeen);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void SetPlayerSettings(const FPlayerSettings& Settings);

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    FPlayerSettings GetPlayerSettings() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    FLevelProgressData GetLevelProgress(int32 LevelID) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    TArray<FLevelProgressData> GetAllLevelProgress() const { return CurrentSaveData ? CurrentSaveData->LevelProgress : TArray<FLevelProgressData>(); }

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    int32 GetTotalStars() const { return CurrentSaveData ? CurrentSaveData->TotalStars : 0; }

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    FString GetPlayerName() const { return CurrentSaveData ? CurrentSaveData->PlayerName : TEXT(""); }

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool HasSeenTutorial() const { return CurrentSaveData ? CurrentSaveData->bHasSeenTutorial : false; }

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    FDateTime GetLastSaveTime() const { return CurrentSaveData ? CurrentSaveData->SaveTimestamp : FDateTime(); }

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool IsLevelCompleted(int32 LevelID) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    bool IsLevelUnlocked(int32 LevelID) const;

    UFUNCTION(BlueprintCallable, Category = "榫卯存档")
    void AddPlayTime(float DeltaTime);

    UPROPERTY(BlueprintAssignable, Category = "榫卯存档")
    FOnSaveCompleted OnSaveCompleted;

    UPROPERTY(BlueprintAssignable, Category = "榫卯存档")
    FOnLoadCompleted OnLoadCompleted;

    UPROPERTY(BlueprintAssignable, Category = "榫卯存档")
    FOnSaveFailed OnSaveFailed;

    UPROPERTY(BlueprintAssignable, Category = "榫卯存档")
    FOnLoadFailed OnLoadFailed;

private:
    void InitializeSaveData();
    void RecalculateTotalStars();
    FString GeneratePartIdentifier(AMT_MortiseTenonPart* Part, int32 Index) const;
    
    UPROPERTY()
    UMT_SaveGame* CurrentSaveData;

    static UMT_SaveManager* Instance;
    static const int32 CURRENT_SAVE_VERSION;
};
