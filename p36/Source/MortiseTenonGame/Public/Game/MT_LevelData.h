#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "MortiseTenon/MT_MortiseTenonPart.h"
#include "MT_LevelData.generated.h"

USTRUCT(BlueprintType)
struct FPartSpawnData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    TSubclassOf<AMT_MortiseTenonPart> PartClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FVector SpawnLocation;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FRotator SpawnRotation;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FVector TargetLocation;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FRotator TargetRotation;
};

UCLASS()
class MORTISETENONGAME_API AMT_LevelData : public AActor
{
    GENERATED_BODY()

public:
    AMT_LevelData();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    int32 LevelID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FString LevelName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FString LevelDescription;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    EPartDifficulty Difficulty;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    FString HistoricalContext;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    TArray<FPartSpawnData> PartSpawnData;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    float TimeLimit;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯关卡")
    int32 MaxHints;
};
