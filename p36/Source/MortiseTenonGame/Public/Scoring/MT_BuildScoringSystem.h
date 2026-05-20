#pragma once

#include "CoreMinimal.h"
#include "MT_BuildScoringSystem.generated.h"

UENUM(BlueprintType)
enum class EScoringCategory : uint8
{
    SC_PositionAccuracy UMETA(DisplayName = "位置精度"),
    SC_RotationAccuracy UMETA(DisplayName = "角度精度"),
    SC_SnapEfficiency UMETA(DisplayName = "吸附效率"),
    SC_CompletionTime UMETA(DisplayName = "完成时间"),
    SC_NumberOfMoves UMETA(DisplayName = "移动次数"),
    SC_Overall UMETA(DisplayName = "总分")
};

USTRUCT(BlueprintType)
struct FScoreBreakdown
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float PositionScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float RotationScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float SnapEfficiencyScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float TimeScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float EfficiencyScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float TotalScore;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 StarRating;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    FString Grade;
};

USTRUCT(BlueprintType)
struct FBuildStatistics
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float TotalBuildTime;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 TotalMoves;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 TotalRotations;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 SuccessfulSnaps;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 FailedSnaps;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float AveragePositionError;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    float AverageRotationError;

    UPROPERTY(BlueprintReadOnly, Category = "榫卯评分")
    int32 HintsUsed;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnScoreCalculated, const FScoreBreakdown&, ScoreBreakdown);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_BuildScoringSystem : public UObject
{
    GENERATED_BODY()

public:
    UMT_BuildScoringSystem();

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void StartScoringSession(int32 LevelID);

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void RecordPartMove();

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void RecordPartRotation();

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void RecordSnapAttempt(bool bSuccessful);

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void RecordHintUsed();

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void RecordPartAccuracy(const FVector& PositionError, const FRotator& RotationError);

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    FScoreBreakdown CalculateFinalScore();

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    FBuildStatistics GetCurrentStatistics() const { return CurrentStats; }

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    float GetCurrentProgressScore() const;

    UFUNCTION(BlueprintCallable, Category = "榫卯评分")
    void ResetScoring();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯评分")
    float TargetTimeForThreeStars;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯评分")
    float TargetTimeForTwoStars;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯评分")
    float PerfectPositionThreshold;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "榫卯评分")
    float PerfectRotationThreshold;

    UPROPERTY(EditAnywhere, Category = "榫卯评分")
    TMap<EScoringCategory, float> CategoryWeights;

    UPROPERTY(BlueprintAssignable, Category = "榫卯评分事件")
    FOnScoreCalculated OnScoreCalculated;

private:
    float CalculatePositionScore() const;
    float CalculateRotationScore() const;
    float CalculateSnapEfficiencyScore() const;
    float CalculateTimeScore() const;
    float CalculateEfficiencyScore() const;
    int32 CalculateStarRating(float TotalScore) const;
    FString CalculateGrade(float TotalScore) const;

    int32 CurrentLevelID;
    FBuildStatistics CurrentStats;
    FDateTime SessionStartTime;
    bool bSessionActive;

    TArray<float> PositionErrors;
    TArray<float> RotationErrors;
};
