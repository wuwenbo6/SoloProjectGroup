#include "Scoring/MT_BuildScoringSystem.h"

UMT_BuildScoringSystem::UMT_BuildScoringSystem()
{
    TargetTimeForThreeStars = 60.0f;
    TargetTimeForTwoStars = 120.0f;
    PerfectPositionThreshold = 1.0f;
    PerfectRotationThreshold = 2.0f;
    bSessionActive = false;

    CategoryWeights.Add(EScoringCategory::SC_PositionAccuracy, 0.25f);
    CategoryWeights.Add(EScoringCategory::SC_RotationAccuracy, 0.25f);
    CategoryWeights.Add(EScoringCategory::SC_SnapEfficiency, 0.2f);
    CategoryWeights.Add(EScoringCategory::SC_CompletionTime, 0.2f);
    CategoryWeights.Add(EScoringCategory::SC_NumberOfMoves, 0.1f);
}

void UMT_BuildScoringSystem::StartScoringSession(int32 LevelID)
{
    CurrentLevelID = LevelID;
    SessionStartTime = FDateTime::Now();
    bSessionActive = true;
    ResetScoring();
}

void UMT_BuildScoringSystem::RecordPartMove()
{
    if (bSessionActive)
    {
        CurrentStats.TotalMoves++;
    }
}

void UMT_BuildScoringSystem::RecordPartRotation()
{
    if (bSessionActive)
    {
        CurrentStats.TotalRotations++;
    }
}

void UMT_BuildScoringSystem::RecordSnapAttempt(bool bSuccessful)
{
    if (bSessionActive)
    {
        if (bSuccessful)
        {
            CurrentStats.SuccessfulSnaps++;
        }
        else
        {
            CurrentStats.FailedSnaps++;
        }
    }
}

void UMT_BuildScoringSystem::RecordHintUsed()
{
    if (bSessionActive)
    {
        CurrentStats.HintsUsed++;
    }
}

void UMT_BuildScoringSystem::RecordPartAccuracy(const FVector& PositionError, const FRotator& RotationError)
{
    if (bSessionActive)
    {
        float PosErrorMag = PositionError.Size();
        float RotErrorMag = FMath::Abs(RotationError.Pitch) + FMath::Abs(RotationError.Yaw) + FMath::Abs(RotationError.Roll);

        PositionErrors.Add(PosErrorMag);
        RotationErrors.Add(RotErrorMag);

        float TotalPosError = 0.0f;
        for (float Err : PositionErrors) TotalPosError += Err;
        CurrentStats.AveragePositionError = PositionErrors.Num() > 0 ? TotalPosError / PositionErrors.Num() : 0.0f;

        float TotalRotError = 0.0f;
        for (float Err : RotationErrors) TotalRotError += Err;
        CurrentStats.AverageRotationError = RotationErrors.Num() > 0 ? TotalRotError / RotationErrors.Num() : 0.0f;
    }
}

FScoreBreakdown UMT_BuildScoringSystem::CalculateFinalScore()
{
    FScoreBreakdown Breakdown;

    if (!bSessionActive)
    {
        return Breakdown;
    }

    FTimespan Elapsed = FDateTime::Now() - SessionStartTime;
    CurrentStats.TotalBuildTime = Elapsed.GetTotalSeconds();

    Breakdown.PositionScore = CalculatePositionScore();
    Breakdown.RotationScore = CalculateRotationScore();
    Breakdown.SnapEfficiencyScore = CalculateSnapEfficiencyScore();
    Breakdown.TimeScore = CalculateTimeScore();
    Breakdown.EfficiencyScore = CalculateEfficiencyScore();

    float PosWeight = 0.0f, RotWeight = 0.0f, SnapWeight = 0.0f, TimeWeight = 0.0f, MoveWeight = 0.0f;
    if (CategoryWeights.Contains(EScoringCategory::SC_PositionAccuracy)) PosWeight = *CategoryWeights.Find(EScoringCategory::SC_PositionAccuracy);
    if (CategoryWeights.Contains(EScoringCategory::SC_RotationAccuracy)) RotWeight = *CategoryWeights.Find(EScoringCategory::SC_RotationAccuracy);
    if (CategoryWeights.Contains(EScoringCategory::SC_SnapEfficiency)) SnapWeight = *CategoryWeights.Find(EScoringCategory::SC_SnapEfficiency);
    if (CategoryWeights.Contains(EScoringCategory::SC_CompletionTime)) TimeWeight = *CategoryWeights.Find(EScoringCategory::SC_CompletionTime);
    if (CategoryWeights.Contains(EScoringCategory::SC_NumberOfMoves)) MoveWeight = *CategoryWeights.Find(EScoringCategory::SC_NumberOfMoves);

    Breakdown.TotalScore = 
        Breakdown.PositionScore * PosWeight +
        Breakdown.RotationScore * RotWeight +
        Breakdown.SnapEfficiencyScore * SnapWeight +
        Breakdown.TimeScore * TimeWeight +
        Breakdown.EfficiencyScore * MoveWeight;

    Breakdown.StarRating = CalculateStarRating(Breakdown.TotalScore);
    Breakdown.Grade = CalculateGrade(Breakdown.TotalScore);

    OnScoreCalculated.Broadcast(Breakdown);

    return Breakdown;
}

float UMT_BuildScoringSystem::GetCurrentProgressScore() const
{
    if (!bSessionActive || PositionErrors.Num() == 0)
    {
        return 0.0f;
    }

    float AvgPosScore = CalculatePositionScore();
    float AvgRotScore = CalculateRotationScore();
    float SnapScore = CalculateSnapEfficiencyScore();

    return (AvgPosScore + AvgRotScore + SnapScore) / 3.0f;
}

void UMT_BuildScoringSystem::ResetScoring()
{
    CurrentStats.TotalBuildTime = 0.0f;
    CurrentStats.TotalMoves = 0;
    CurrentStats.TotalRotations = 0;
    CurrentStats.SuccessfulSnaps = 0;
    CurrentStats.FailedSnaps = 0;
    CurrentStats.AveragePositionError = 0.0f;
    CurrentStats.AverageRotationError = 0.0f;
    CurrentStats.HintsUsed = 0;

    PositionErrors.Empty();
    RotationErrors.Empty();
}

float UMT_BuildScoringSystem::CalculatePositionScore() const
{
    if (PositionErrors.Num() == 0)
    {
        return 100.0f;
    }

    float AvgError = 0.0f;
    for (float Err : PositionErrors) AvgError += Err;
    AvgError /= PositionErrors.Num();

    if (AvgError <= PerfectPositionThreshold)
    {
        return 100.0f;
    }
    else if (AvgError <= 5.0f)
    {
        return 100.0f - (AvgError - PerfectPositionThreshold) * 5.0f;
    }
    else if (AvgError <= 20.0f)
    {
        return 80.0f - (AvgError - 5.0f) * 2.0f;
    }
    else
    {
        return FMath::Max(0.0f, 50.0f - (AvgError - 20.0f) * 1.5f);
    }
}

float UMT_BuildScoringSystem::CalculateRotationScore() const
{
    if (RotationErrors.Num() == 0)
    {
        return 100.0f;
    }

    float AvgError = 0.0f;
    for (float Err : RotationErrors) AvgError += Err;
    AvgError /= RotationErrors.Num();

    if (AvgError <= PerfectRotationThreshold)
    {
        return 100.0f;
    }
    else if (AvgError <= 10.0f)
    {
        return 100.0f - (AvgError - PerfectRotationThreshold) * 2.5f;
    }
    else if (AvgError <= 30.0f)
    {
        return 80.0f - (AvgError - 10.0f) * 1.5f;
    }
    else
    {
        return FMath::Max(0.0f, 50.0f - (AvgError - 30.0f) * 1.0f);
    }
}

float UMT_BuildScoringSystem::CalculateSnapEfficiencyScore() const
{
    int32 TotalAttempts = CurrentStats.SuccessfulSnaps + CurrentStats.FailedSnaps;
    if (TotalAttempts == 0)
    {
        return 100.0f;
    }

    float SuccessRate = static_cast<float>(CurrentStats.SuccessfulSnaps) / TotalAttempts;
    return SuccessRate * 100.0f;
}

float UMT_BuildScoringSystem::CalculateTimeScore() const
{
    float TimeBonus = 0.0f;
    
    if (CurrentStats.TotalBuildTime <= TargetTimeForThreeStars)
    {
        TimeBonus = 100.0f;
    }
    else if (CurrentStats.TotalBuildTime <= TargetTimeForTwoStars)
    {
        float Progress = (CurrentStats.TotalBuildTime - TargetTimeForThreeStars) / (TargetTimeForTwoStars - TargetTimeForThreeStars);
        TimeBonus = 100.0f - Progress * 30.0f;
    }
    else
    {
        TimeBonus = FMath::Max(0.0f, 70.0f - (CurrentStats.TotalBuildTime - TargetTimeForTwoStars) * 0.5f);
    }

    return TimeBonus;
}

float UMT_BuildScoringSystem::CalculateEfficiencyScore() const
{
    int32 ExpectedMoves = 10 + CurrentLevelID * 2;
    float MoveEfficiency = FMath::Min(1.0f, static_cast<float>(ExpectedMoves) / FMath::Max(1, CurrentStats.TotalMoves));
    
    float HintPenalty = CurrentStats.HintsUsed * 5.0f;

    return FMath::Max(0.0f, MoveEfficiency * 100.0f - HintPenalty);
}

int32 UMT_BuildScoringSystem::CalculateStarRating(float TotalScore) const
{
    if (TotalScore >= 90.0f)
    {
        return 3;
    }
    else if (TotalScore >= 70.0f)
    {
        return 2;
    }
    else if (TotalScore >= 50.0f)
    {
        return 1;
    }
    else
    {
        return 0;
    }
}

FString UMT_BuildScoringSystem::CalculateGrade(float TotalScore) const
{
    if (TotalScore >= 95.0f) return TEXT("S");
    if (TotalScore >= 90.0f) return TEXT("A+");
    if (TotalScore >= 85.0f) return TEXT("A");
    if (TotalScore >= 80.0f) return TEXT("A-");
    if (TotalScore >= 75.0f) return TEXT("B+");
    if (TotalScore >= 70.0f) return TEXT("B");
    if (TotalScore >= 65.0f) return TEXT("B-");
    if (TotalScore >= 60.0f) return TEXT("C+");
    if (TotalScore >= 55.0f) return TEXT("C");
    if (TotalScore >= 50.0f) return TEXT("C-");
    return TEXT("D");
}
