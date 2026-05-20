#pragma once

#include "CoreMinimal.h"
#include "MT_RankingSystem.generated.h"

UENUM(BlueprintType)
enum class ERankingCategory : uint8
{
    RC_Knowledge UMETA(DisplayName = "知识积分"),
    RC_BuildSpeed UMETA(DisplayName = "搭建速度"),
    RC_Creativity UMETA(DisplayName = "创意评分"),
    RC_Accuracy UMETA(DisplayName = "精准度"),
    RC_Collection UMETA(DisplayName = "部件收集"),
    RC_Overall UMETA(DisplayName = "综合排名")
};

USTRUCT(BlueprintType)
struct FRankingEntry
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FString PlayerID;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FString PlayerName;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    int32 Rank;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    float Score;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    int32 Level;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FString Title;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FString AvatarURL;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FDateTime LastUpdated;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    int32 CountryCode;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    bool bIsOnline;
};

USTRUCT(BlueprintType)
struct FPlayerStatistics
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    float TotalKnowledgeScore;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 QuizzesCompleted;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    float AverageQuizScore;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 LevelsCompleted;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    float BestLevelTime;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 TotalPartsPlaced;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 PerfectPlacements;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 CustomBuildsCreated;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 BuildLikesReceived;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 PartsUnlocked;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    float TotalPlayTimeHours;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 MultiplayerGamesPlayed;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 FriendsCount;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 CurrentStreak;

    UPROPERTY(BlueprintReadOnly, Category = "玩家统计")
    int32 BestStreak;
};

USTRUCT(BlueprintType)
struct FAchievementData
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    FString AchievementID;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    FString Name;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    FString Description;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    int32 Points;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    bool bIsUnlocked;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    FDateTime UnlockTime;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    float Progress;

    UPROPERTY(BlueprintReadOnly, Category = "成就")
    float Target;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnRankChanged, int32, NewRank);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAchievementUnlocked, const FAchievementData&, Achievement);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnScoreIncreased, float, NewScore, float, Delta);

UCLASS(Blueprintable, BlueprintType)
class MORTISETENONGAME_API UMT_RankingSystem : public UObject
{
    GENERATED_BODY()

public:
    UMT_RankingSystem();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void InitializeRankingSystem();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    TArray<FRankingEntry> GetTopRankings(ERankingCategory Category, int32 Count = 100);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    TArray<FRankingEntry> GetRankingsAroundPlayer(ERankingCategory Category, int32 Range = 5);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    FRankingEntry GetPlayerRanking(ERankingCategory Category);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    int32 GetPlayerRank(ERankingCategory Category);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void AddKnowledgeScore(float ScoreToAdd, const FString& Source = "");

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void AddBuildScore(float ScoreToAdd, const FString& BuildID = "");

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void RecordQuizCompletion(float Score, int32 CorrectAnswers, int32 TotalQuestions);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void RecordLevelCompletion(float Time, int32 StarsEarned, float AccuracyScore);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void RecordPartPlacement(bool bIsPerfectPlacement);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void RecordBuildLiked();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void UnlockPart(const FString& PartID);

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void UpdateDailyStreak();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    FPlayerStatistics GetPlayerStatistics() const { return PlayerStats; }

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    TArray<FAchievementData> GetAllAchievements() const;

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    TArray<FAchievementData> GetUnlockedAchievements() const;

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    TArray<FAchievementData> GetLockedAchievements() const;

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    FString GetPlayerTitle() const;

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    float GetTotalScore() const;

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void RefreshGlobalRankings();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void SavePlayerProgress();

    UFUNCTION(BlueprintCallable, Category = "排行榜")
    void LoadPlayerProgress();

    UPROPERTY(BlueprintAssignable, Category = "排行榜事件")
    FOnRankChanged OnRankChanged;

    UPROPERTY(BlueprintAssignable, Category = "排行榜事件")
    FOnAchievementUnlocked OnAchievementUnlocked;

    UPROPERTY(BlueprintAssignable, Category = "排行榜事件")
    FOnScoreIncreased OnScoreIncreased;

    UPROPERTY(BlueprintReadOnly, Category = "排行榜")
    FString LocalPlayerID;

private:
    FPlayerStatistics PlayerStats;

    UPROPERTY()
    TArray<FAchievementData> Achievements;

    UPROPERTY()
    TMap<ERankingCategory, TArray<FRankingEntry>> GlobalRankings;

    void InitializeDefaultAchievements();
    void CheckAchievements();
    void UpdatePlayerTitle();
    float CalculateOverallScore() const;

    FString CurrentPlayerTitle;
};
