#include "Save/MT_SaveManager.h"
#include "Kismet/GameplayStatics.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "Physics/MT_PhysicsInteractionComponent.h"

UMT_SaveManager* UMT_SaveManager::Instance = nullptr;
const int32 UMT_SaveManager::CURRENT_SAVE_VERSION = 1;

UMT_SaveManager::UMT_SaveManager()
{
    CurrentSaveData = nullptr;
}

UMT_SaveManager* UMT_SaveManager::GetInstance()
{
    if (!Instance)
    {
        Instance = NewObject<UMT_SaveManager>();
        Instance->AddToRoot();
        Instance->InitializeSaveData();
    }
    return Instance;
}

bool UMT_SaveManager::SaveGame(const FString& SlotName)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }

    CurrentSaveData->SaveTimestamp = FDateTime::Now();
    CurrentSaveData->SaveVersion = CURRENT_SAVE_VERSION;

    bool bSuccess = UGameplayStatics::SaveGameToSlot(CurrentSaveData, SlotName, 0);
    
    if (bSuccess)
    {
        UE_LOG(LogTemp, Log, TEXT("存档成功: %s"), *SlotName);
        OnSaveCompleted.Broadcast();
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("存档失败: %s"), *SlotName);
        OnSaveFailed.Broadcast();
    }
    
    return bSuccess;
}

bool UMT_SaveManager::LoadGame(const FString& SlotName)
{
    if (DoesSaveExist(SlotName))
    {
        USaveGame* LoadedData = UGameplayStatics::LoadGameFromSlot(SlotName, 0);
        UMT_SaveGame* MortiseSave = Cast<UMT_SaveGame>(LoadedData);
        
        if (MortiseSave)
        {
            CurrentSaveData = MortiseSave;
            
            if (CurrentSaveData->SaveVersion < CURRENT_SAVE_VERSION)
            {
                UE_LOG(LogTemp, Warning, TEXT("存档版本不兼容，已升级"));
            }
            
            UE_LOG(LogTemp, Log, TEXT("加载存档成功: %s"), *SlotName);
            OnLoadCompleted.Broadcast();
            return true;
        }
        else
        {
            UE_LOG(LogTemp, Error, TEXT("存档数据类型错误: %s"), *SlotName);
        }
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("存档不存在，创建新存档: %s"), *SlotName);
    }
    
    InitializeSaveData();
    OnLoadFailed.Broadcast();
    return false;
}

bool UMT_SaveManager::DoesSaveExist(const FString& SlotName)
{
    return UGameplayStatics::DoesSaveGameExist(SlotName, 0);
}

void UMT_SaveManager::DeleteSave(const FString& SlotName)
{
    if (DoesSaveExist(SlotName))
    {
        UGameplayStatics::DeleteGameInSlot(SlotName, 0);
        UE_LOG(LogTemp, Log, TEXT("删除存档成功: %s"), *SlotName);
    }
}

void UMT_SaveManager::UpdateLevelProgress(int32 LevelID, bool bCompleted, float Time, int32 Stars)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }

    bool bFound = false;
    for (FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
    {
        if (Progress.LevelID == LevelID)
        {
            Progress.bIsCompleted = bCompleted;
            if (bCompleted)
            {
                if (Progress.BestTime <= 0.0f || Time < Progress.BestTime)
                {
                    Progress.BestTime = Time;
                }
                if (Stars > Progress.StarsEarned)
                {
                    Progress.StarsEarned = Stars;
                }
            }
            bFound = true;
            break;
        }
    }

    if (!bFound)
    {
        FLevelProgressData NewProgress;
        NewProgress.LevelID = LevelID;
        NewProgress.bIsUnlocked = true;
        NewProgress.bIsCompleted = bCompleted;
        NewProgress.BestTime = bCompleted ? Time : 0.0f;
        NewProgress.StarsEarned = bCompleted ? Stars : 0;
        NewProgress.CurrentProgress = 0.0f;
        CurrentSaveData->LevelProgress.Add(NewProgress);
    }

    RecalculateTotalStars();
}

void UMT_SaveManager::SaveCurrentLevelState(int32 LevelID, const TArray<AMT_MortiseTenonPart*>& Parts, float PlayTime)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }

    FLevelProgressData* LevelData = nullptr;
    for (FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
    {
        if (Progress.LevelID == LevelID)
        {
            LevelData = &Progress;
            break;
        }
    }

    if (!LevelData)
    {
        FLevelProgressData NewProgress;
        NewProgress.LevelID = LevelID;
        NewProgress.bIsUnlocked = true;
        NewProgress.bIsCompleted = false;
        NewProgress.BestTime = 0.0f;
        NewProgress.StarsEarned = 0;
        CurrentSaveData->LevelProgress.Add(NewProgress);
        LevelData = &CurrentSaveData->LevelProgress.Last();
    }

    if (LevelData)
    {
        LevelData->PartStates.Empty();
        
        int32 PlacedCount = 0;
        for (int32 i = 0; i < Parts.Num(); ++i)
        {
            AMT_MortiseTenonPart* Part = Parts[i];
            if (Part && IsValid(Part))
            {
                FPartSaveData PartData;
                PartData.PartIdentifier = GeneratePartIdentifier(Part, i);
                PartData.WorldLocation = Part->GetActorLocation();
                PartData.WorldRotation = Part->GetActorRotation();
                PartData.bIsPlaced = Part->IsPartPlaced();
                
                if (Part->PhysicsComponent)
                {
                    PartData.bIsSnapped = Part->PhysicsComponent->IsSnapped();
                    if (Part->PhysicsComponent->GetAttachParent() && Part->PhysicsComponent->GetAttachParent()->GetOwner())
                    {
                        PartData.SnappedPartnerIdentifier = Part->PhysicsComponent->GetAttachParent()->GetOwner()->GetName();
                    }
                }
                
                LevelData->PartStates.Add(PartData);
                
                if (PartData.bIsPlaced)
                {
                    PlacedCount++;
                }
            }
        }
        
        if (Parts.Num() > 0)
        {
            LevelData->CurrentProgress = static_cast<float>(PlacedCount) / static_cast<float>(Parts.Num());
        }
        
        UE_LOG(LogTemp, Log, TEXT("保存关卡 %d 状态: %d 个部件, 进度 %.1f%%"), 
               LevelID, LevelData->PartStates.Num(), LevelData->CurrentProgress * 100.0f);
    }
}

TArray<FPartSaveData> UMT_SaveManager::LoadLevelState(int32 LevelID) const
{
    if (CurrentSaveData)
    {
        for (const FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
        {
            if (Progress.LevelID == LevelID)
            {
                UE_LOG(LogTemp, Log, TEXT("加载关卡 %d 状态: %d 个部件"), 
                       LevelID, Progress.PartStates.Num());
                return Progress.PartStates;
            }
        }
    }
    return TArray<FPartSaveData>();
}

void UMT_SaveManager::UnlockLevel(int32 LevelID)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }

    bool bFound = false;
    for (FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
    {
        if (Progress.LevelID == LevelID)
        {
            Progress.bIsUnlocked = true;
            bFound = true;
            break;
        }
    }

    if (!bFound)
    {
        FLevelProgressData NewProgress;
        NewProgress.LevelID = LevelID;
        NewProgress.bIsUnlocked = true;
        NewProgress.bIsCompleted = false;
        NewProgress.BestTime = 0.0f;
        NewProgress.StarsEarned = 0;
        NewProgress.CurrentProgress = 0.0f;
        CurrentSaveData->LevelProgress.Add(NewProgress);
    }
}

void UMT_SaveManager::AddAchievement(const FString& AchievementID)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }

    if (!CurrentSaveData->UnlockedAchievements.Contains(AchievementID))
    {
        CurrentSaveData->UnlockedAchievements.Add(AchievementID);
        UE_LOG(LogTemp, Log, TEXT("解锁成就: %s"), *AchievementID);
    }
}

void UMT_SaveManager::SetCurrentLevel(int32 LevelID)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }
    CurrentSaveData->CurrentLevelID = LevelID;
}

void UMT_SaveManager::SetPlayerName(const FString& Name)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }
    CurrentSaveData->PlayerName = Name;
}

void UMT_SaveManager::SetHasSeenTutorial(bool bSeen)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }
    CurrentSaveData->bHasSeenTutorial = bSeen;
}

void UMT_SaveManager::SetPlayerSettings(const FPlayerSettings& Settings)
{
    if (!CurrentSaveData)
    {
        InitializeSaveData();
    }
    CurrentSaveData->PlayerSettings = Settings;
}

FPlayerSettings UMT_SaveManager::GetPlayerSettings() const
{
    if (CurrentSaveData)
    {
        return CurrentSaveData->PlayerSettings;
    }
    
    FPlayerSettings DefaultSettings;
    DefaultSettings.MusicVolume = 1.0f;
    DefaultSettings.SFXVolume = 1.0f;
    DefaultSettings.bShowHints = true;
    DefaultSettings.bShowTutorials = true;
    DefaultSettings.Difficulty = 1;
    return DefaultSettings;
}

FLevelProgressData UMT_SaveManager::GetLevelProgress(int32 LevelID) const
{
    if (CurrentSaveData)
    {
        for (const FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
        {
            if (Progress.LevelID == LevelID)
            {
                return Progress;
            }
        }
    }
    
    FLevelProgressData EmptyProgress;
    EmptyProgress.LevelID = LevelID;
    EmptyProgress.bIsUnlocked = false;
    EmptyProgress.bIsCompleted = false;
    EmptyProgress.BestTime = 0.0f;
    EmptyProgress.StarsEarned = 0;
    EmptyProgress.CurrentProgress = 0.0f;
    return EmptyProgress;
}

bool UMT_SaveManager::IsLevelCompleted(int32 LevelID) const
{
    FLevelProgressData Progress = GetLevelProgress(LevelID);
    return Progress.bIsCompleted;
}

bool UMT_SaveManager::IsLevelUnlocked(int32 LevelID) const
{
    FLevelProgressData Progress = GetLevelProgress(LevelID);
    return Progress.bIsUnlocked;
}

void UMT_SaveManager::AddPlayTime(float DeltaTime)
{
    if (CurrentSaveData)
    {
        CurrentSaveData->TotalPlayTime += DeltaTime;
    }
}

void UMT_SaveManager::InitializeSaveData()
{
    CurrentSaveData = Cast<UMT_SaveGame>(UGameplayStatics::CreateSaveGameObject(UMT_SaveGame::StaticClass()));
    
    if (CurrentSaveData)
    {
        CurrentSaveData->PlayerName = TEXT("玩家");
        CurrentSaveData->TotalStars = 0;
        CurrentSaveData->TotalPlayTime = 0.0f;
        CurrentSaveData->CurrentLevelID = 1;
        CurrentSaveData->bHasSeenTutorial = false;
        CurrentSaveData->SaveVersion = CURRENT_SAVE_VERSION;
        CurrentSaveData->SaveTimestamp = FDateTime::Now();
        
        CurrentSaveData->PlayerSettings.MusicVolume = 1.0f;
        CurrentSaveData->PlayerSettings.SFXVolume = 1.0f;
        CurrentSaveData->PlayerSettings.bShowHints = true;
        CurrentSaveData->PlayerSettings.bShowTutorials = true;
        CurrentSaveData->PlayerSettings.Difficulty = 1;
        
        UnlockLevel(1);
    }
}

void UMT_SaveManager::RecalculateTotalStars()
{
    if (CurrentSaveData)
    {
        int32 Total = 0;
        for (const FLevelProgressData& Progress : CurrentSaveData->LevelProgress)
        {
            Total += Progress.StarsEarned;
        }
        CurrentSaveData->TotalStars = Total;
    }
}

FString UMT_SaveManager::GeneratePartIdentifier(AMT_MortiseTenonPart* Part, int32 Index) const
{
    if (Part && IsValid(Part))
    {
        return FString::Printf(TEXT("Part_%s_%d"), *Part->PartName, Index);
    }
    return FString::Printf(TEXT("Part_Unnamed_%d"), Index);
}
