#pragma once

#include "CoreMinimal.h"
#include "SaveGame/SaveGame.h"
#include "MT_SaveGame.generated.h"

USTRUCT(BlueprintType)
struct FPartSaveData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FString PartIdentifier;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FVector WorldLocation;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FRotator WorldRotation;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bIsPlaced;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bIsSnapped;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FString SnappedPartnerIdentifier;
};

USTRUCT(BlueprintType)
struct FLevelProgressData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 LevelID;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bIsUnlocked;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bIsCompleted;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    float BestTime;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 StarsEarned;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    float CurrentProgress;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    TArray<FPartSaveData> PartStates;
};

USTRUCT(BlueprintType)
struct FPlayerSettings
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    float MusicVolume;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    float SFXVolume;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bShowHints;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bShowTutorials;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 Difficulty;
};

UCLASS()
class MORTISETENONGAME_API UMT_SaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UMT_SaveGame();

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 TotalStars;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    float TotalPlayTime;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    TArray<FLevelProgressData> LevelProgress;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    TArray<FString> UnlockedAchievements;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 CurrentLevelID;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    bool bHasSeenTutorial;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FPlayerSettings PlayerSettings;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    int32 SaveVersion;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯存档")
    FDateTime SaveTimestamp;
};
