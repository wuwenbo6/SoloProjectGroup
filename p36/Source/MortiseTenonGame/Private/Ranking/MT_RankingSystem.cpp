#include "Ranking/MT_RankingSystem.h"

UMT_RankingSystem::UMT_RankingSystem()
{
    LocalPlayerID = "LOCAL_PLAYER_001";
    CurrentPlayerTitle = "榫卯学徒";
}

void UMT_RankingSystem::InitializeRankingSystem()
{
    InitializeDefaultAchievements();
    LoadPlayerProgress();
}

TArray<FRankingEntry> UMT_RankingSystem::GetTopRankings(ERankingCategory Category, int32 Count)
{
    if (!GlobalRankings.Contains(Category))
    {
        RefreshGlobalRankings();
    }

    TArray<FRankingEntry> Rankings = GlobalRankings[Category];
    if (Rankings.Num() > Count)
    {
        TArray<FRankingEntry> Result;
        for (int32 i = 0; i < Count; ++i)
        {
            Result.Add(Rankings[i]);
        }
        return Result;
    }
    return Rankings;
}

TArray<FRankingEntry> UMT_RankingSystem::GetRankingsAroundPlayer(ERankingCategory Category, int32 Range)
{
    if (!GlobalRankings.Contains(Category))
    {
        RefreshGlobalRankings();
    }

    TArray<FRankingEntry> Rankings = GlobalRankings[Category];
    int32 PlayerRank = GetPlayerRank(Category);
    int32 StartIdx = FMath::Max(0, PlayerRank - Range);
    int32 EndIdx = FMath::Min(Rankings.Num(), PlayerRank + Range + 1);

    TArray<FRankingEntry> Result;
    for (int32 i = StartIdx; i < EndIdx; ++i)
    {
        Result.Add(Rankings[i]);
    }
    return Result;
}

FRankingEntry UMT_RankingSystem::GetPlayerRanking(ERankingCategory Category)
{
    FRankingEntry Entry;
    Entry.PlayerID = LocalPlayerID;
    Entry.PlayerName = "玩家";
    Entry.Rank = GetPlayerRank(Category);
    Entry.Title = CurrentPlayerTitle;
    Entry.Level = 1;
    Entry.LastUpdated = FDateTime::Now();
    Entry.bIsOnline = true;

    switch (Category)
    {
    case ERankingCategory::RC_Knowledge:
        Entry.Score = PlayerStats.TotalKnowledgeScore;
        break;
    case ERankingCategory::RC_BuildSpeed:
        Entry.Score = PlayerStats.BestLevelTime > 0 ? 1000.0f / PlayerStats.BestLevelTime : 0;
        break;
    case ERankingCategory::RC_Creativity:
        Entry.Score = PlayerStats.CustomBuildsCreated * 100 + PlayerStats.BuildLikesReceived * 50;
        break;
    case ERankingCategory::RC_Accuracy:
        Entry.Score = PlayerStats.TotalPartsPlaced > 0
            ? (float)PlayerStats.PerfectPlacements / PlayerStats.TotalPartsPlaced * 1000
            : 0;
        break;
    case ERankingCategory::RC_Collection:
        Entry.Score = PlayerStats.PartsUnlocked * 100;
        break;
    case ERankingCategory::RC_Overall:
        Entry.Score = CalculateOverallScore();
        break;
    }

    return Entry;
}

int32 UMT_RankingSystem::GetPlayerRank(ERankingCategory Category)
{
    if (!GlobalRankings.Contains(Category))
    {
        RefreshGlobalRankings();
    }

    float PlayerScore = GetPlayerRanking(Category).Score;
    int32 Rank = 1;

    for (const FRankingEntry& Entry : GlobalRankings[Category])
    {
        if (Entry.Score > PlayerScore)
        {
            Rank++;
        }
    }

    return Rank;
}

void UMT_RankingSystem::AddKnowledgeScore(float ScoreToAdd, const FString& Source)
{
    float OldScore = PlayerStats.TotalKnowledgeScore;
    PlayerStats.TotalKnowledgeScore += ScoreToAdd;
    OnScoreIncreased.Broadcast(PlayerStats.TotalKnowledgeScore, ScoreToAdd);
    CheckAchievements();
    UpdatePlayerTitle();
}

void UMT_RankingSystem::AddBuildScore(float ScoreToAdd, const FString& BuildID)
{
    PlayerStats.CustomBuildsCreated++;
    CheckAchievements();
    UpdatePlayerTitle();
}

void UMT_RankingSystem::RecordQuizCompletion(float Score, int32 CorrectAnswers, int32 TotalQuestions)
{
    PlayerStats.QuizzesCompleted++;

    float TotalScore = PlayerStats.AverageQuizScore * (PlayerStats.QuizzesCompleted - 1) + Score;
    PlayerStats.AverageQuizScore = TotalScore / PlayerStats.QuizzesCompleted;

    AddKnowledgeScore(Score * 10, "Quiz");
}

void UMT_RankingSystem::RecordLevelCompletion(float Time, int32 StarsEarned, float AccuracyScore)
{
    PlayerStats.LevelsCompleted++;

    if (PlayerStats.BestLevelTime == 0 || Time < PlayerStats.BestLevelTime)
    {
        PlayerStats.BestLevelTime = Time;
    }

    AddKnowledgeScore(StarsEarned * 100 + AccuracyScore, "LevelComplete");
}

void UMT_RankingSystem::RecordPartPlacement(bool bIsPerfectPlacement)
{
    PlayerStats.TotalPartsPlaced++;
    if (bIsPerfectPlacement)
    {
        PlayerStats.PerfectPlacements++;
    }
    CheckAchievements();
}

void UMT_RankingSystem::RecordBuildLiked()
{
    PlayerStats.BuildLikesReceived++;
    CheckAchievements();
}

void UMT_RankingSystem::UnlockPart(const FString& PartID)
{
    PlayerStats.PartsUnlocked++;
    CheckAchievements();
    UpdatePlayerTitle();
}

void UMT_RankingSystem::UpdateDailyStreak()
{
    PlayerStats.CurrentStreak++;
    if (PlayerStats.CurrentStreak > PlayerStats.BestStreak)
    {
        PlayerStats.BestStreak = PlayerStats.CurrentStreak;
    }
    CheckAchievements();
}

TArray<FAchievementData> UMT_RankingSystem::GetAllAchievements() const
{
    return Achievements;
}

TArray<FAchievementData> UMT_RankingSystem::GetUnlockedAchievements() const
{
    TArray<FAchievementData> Result;
    for (const FAchievementData& Achievement : Achievements)
    {
        if (Achievement.bIsUnlocked)
        {
            Result.Add(Achievement);
        }
    }
    return Result;
}

TArray<FAchievementData> UMT_RankingSystem::GetLockedAchievements() const
{
    TArray<FAchievementData> Result;
    for (const FAchievementData& Achievement : Achievements)
    {
        if (!Achievement.bIsUnlocked)
        {
            Result.Add(Achievement);
        }
    }
    return Result;
}

FString UMT_RankingSystem::GetPlayerTitle() const
{
    return CurrentPlayerTitle;
}

float UMT_RankingSystem::GetTotalScore() const
{
    return CalculateOverallScore();
}

void UMT_RankingSystem::RefreshGlobalRankings()
{
    TArray<FString> Titles = { "榫卯大师", "木工宗师", "建筑泰斗", "国宝级工匠" };
    TArray<float> Scores = { 50000, 30000, 20000, 10000 };

    for (ERankingCategory Category : TEnumRange<ERankingCategory>())
    {
        TArray<FRankingEntry> Rankings;

        for (int32 i = 0; i < 100; ++i)
        {
            FRankingEntry Entry;
            Entry.PlayerID = FString::Printf(TEXT("AI_PLAYER_%d"), i);
            Entry.PlayerName = FString::Printf(TEXT("玩家%d"), i + 1);
            Entry.Rank = i + 1;
            Entry.Score = Scores.Num() > i ? Scores[i] - i * 100 : 1000 - i * 10;
            Entry.Level = FMath::RandRange(1, 50);
            Entry.Title = Titles.Num() > i / 25 ? Titles[i / 25] : "榫卯学徒";
            Entry.LastUpdated = FDateTime::Now();
            Entry.CountryCode = FMath::RandRange(1, 100);
            Entry.bIsOnline = FMath::RandBool();
            Rankings.Add(Entry);
        }

        GlobalRankings.Add(Category, Rankings);
    }
}

void UMT_RankingSystem::SavePlayerProgress()
{
}

void UMT_RankingSystem::LoadPlayerProgress()
{
}

void UMT_RankingSystem::InitializeDefaultAchievements()
{
    Achievements.Empty();

    FAchievementData FirstBuild;
    FirstBuild.AchievementID = "ACH_FIRST_BUILD";
    FirstBuild.Name = "初次搭建";
    FirstBuild.Description = "完成第一个榫卯结构";
    FirstBuild.Points = 100;
    FirstBuild.bIsUnlocked = false;
    FirstBuild.Progress = 0;
    FirstBuild.Target = 1;
    Achievements.Add(FirstBuild);

    FAchievementData TenParts;
    TenParts.AchievementID = "ACH_TEN_PARTS";
    TenParts.Name = "熟能生巧";
    TenParts.Description = "成功放置10个部件";
    TenParts.Points = 200;
    TenParts.bIsUnlocked = false;
    TenParts.Progress = 0;
    TenParts.Target = 10;
    Achievements.Add(TenParts);

    FAchievementData HundredParts;
    HundredParts.AchievementID = "ACH_HUNDRED_PARTS";
    HundredParts.Name = "百匠大成";
    HundredParts.Description = "成功放置100个部件";
    HundredParts.Points = 500;
    HundredParts.bIsUnlocked = false;
    HundredParts.Progress = 0;
    HundredParts.Target = 100;
    Achievements.Add(HundredParts);

    FAchievementData PerfectTen;
    PerfectTen.AchievementID = "ACH_PERFECT_TEN";
    PerfectTen.Name = "精准大师";
    PerfectTen.Description = "完成10次完美放置";
    PerfectTen.Points = 300;
    PerfectTen.bIsUnlocked = false;
    PerfectTen.Progress = 0;
    PerfectTen.Target = 10;
    Achievements.Add(PerfectTen);

    FAchievementData FirstQuiz;
    FirstQuiz.AchievementID = "ACH_FIRST_QUIZ";
    FirstQuiz.Name = "知识探索者";
    FirstQuiz.Description = "完成第一次知识问答";
    FirstQuiz.Points = 150;
    FirstQuiz.bIsUnlocked = false;
    FirstQuiz.Progress = 0;
    FirstQuiz.Target = 1;
    Achievements.Add(FirstQuiz);

    FAchievementData QuizMaster;
    QuizMaster.AchievementID = "ACH_QUIZ_MASTER";
    QuizMaster.Name = "活字典";
    QuizMaster.Description = "完成50次知识问答";
    QuizMaster.Points = 1000;
    QuizMaster.bIsUnlocked = false;
    QuizMaster.Progress = 0;
    QuizMaster.Target = 50;
    Achievements.Add(QuizMaster);

    FAchievementData AllParts;
    AllParts.AchievementID = "ACH_ALL_PARTS";
    AllParts.Name = "收藏家";
    AllParts.Description = "解锁所有部件";
    AllParts.Points = 2000;
    AllParts.bIsUnlocked = false;
    AllParts.Progress = 0;
    AllParts.Target = 14;
    Achievements.Add(AllParts);

    FAchievementData SevenDays;
    SevenDays.AchievementID = "ACH_SEVEN_DAYS";
    SevenDays.Name = "坚持不懈";
    SevenDays.Description = "连续7天登录游戏";
    SevenDays.Points = 500;
    SevenDays.bIsUnlocked = false;
    SevenDays.Progress = 0;
    SevenDays.Target = 7;
    Achievements.Add(SevenDays);

    FAchievementData SpeedRunner;
    SpeedRunner.AchievementID = "ACH_SPEED_RUNNER";
    SpeedRunner.Name = "速度之星";
    SpeedRunner.Description = "在60秒内完成一个关卡";
    SpeedRunner.Points = 400;
    SpeedRunner.bIsUnlocked = false;
    SpeedRunner.Progress = 0;
    SpeedRunner.Target = 1;
    Achievements.Add(SpeedRunner);

    FAchievementData FirstBuildShare;
    FirstBuildShare.AchievementID = "ACH_FIRST_SHARE";
    FirstBuildShare.Name = "乐于分享";
    FirstBuildShare.Description = "分享你的第一个自定义搭建作品";
    FirstBuildShare.Points = 200;
    FirstBuildShare.bIsUnlocked = false;
    FirstBuildShare.Progress = 0;
    FirstBuildShare.Target = 1;
    Achievements.Add(FirstBuildShare);

    FAchievementData DougongUnlock;
    DougongUnlock.AchievementID = "ACH_DOUGONG_UNLOCK";
    DougongUnlock.Name = "斗拱大师";
    DougongUnlock.Description = "解锁斗拱部件";
    DougongUnlock.Points = 800;
    DougongUnlock.bIsUnlocked = false;
    DougongUnlock.Progress = 0;
    DougongUnlock.Target = 1;
    Achievements.Add(DougongUnlock);

    FAchievementData KnowledgeKing;
    KnowledgeKing.AchievementID = "ACH_KNOWLEDGE_KING";
    KnowledgeKing.Name = "知识王者";
    KnowledgeKing.Description = "知识积分达到10000分";
    KnowledgeKing.Points = 1500;
    KnowledgeKing.bIsUnlocked = false;
    KnowledgeKing.Progress = 0;
    KnowledgeKing.Target = 10000;
    Achievements.Add(KnowledgeKing);
}

void UMT_RankingSystem::CheckAchievements()
{
    for (FAchievementData& Achievement : Achievements)
    {
        if (Achievement.bIsUnlocked)
            continue;

        if (Achievement.AchievementID == "ACH_FIRST_BUILD")
        {
            Achievement.Progress = PlayerStats.LevelsCompleted >= 1 ? 1 : 0;
        }
        else if (Achievement.AchievementID == "ACH_TEN_PARTS")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.TotalPartsPlaced, 10.0f);
        }
        else if (Achievement.AchievementID == "ACH_HUNDRED_PARTS")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.TotalPartsPlaced, 100.0f);
        }
        else if (Achievement.AchievementID == "ACH_PERFECT_TEN")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.PerfectPlacements, 10.0f);
        }
        else if (Achievement.AchievementID == "ACH_FIRST_QUIZ")
        {
            Achievement.Progress = PlayerStats.QuizzesCompleted >= 1 ? 1 : 0;
        }
        else if (Achievement.AchievementID == "ACH_QUIZ_MASTER")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.QuizzesCompleted, 50.0f);
        }
        else if (Achievement.AchievementID == "ACH_ALL_PARTS")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.PartsUnlocked, 14.0f);
        }
        else if (Achievement.AchievementID == "ACH_SEVEN_DAYS")
        {
            Achievement.Progress = FMath::Min((float)PlayerStats.CurrentStreak, 7.0f);
        }
        else if (Achievement.AchievementID == "ACH_SPEED_RUNNER")
        {
            Achievement.Progress = (PlayerStats.BestLevelTime > 0 && PlayerStats.BestLevelTime <= 60) ? 1 : 0;
        }
        else if (Achievement.AchievementID == "ACH_FIRST_SHARE")
        {
            Achievement.Progress = PlayerStats.CustomBuildsCreated >= 1 ? 1 : 0;
        }
        else if (Achievement.AchievementID == "ACH_KNOWLEDGE_KING")
        {
            Achievement.Progress = FMath::Min(PlayerStats.TotalKnowledgeScore, 10000.0f);
        }

        if (Achievement.Progress >= Achievement.Target && !Achievement.bIsUnlocked)
        {
            Achievement.bIsUnlocked = true;
            Achievement.UnlockTime = FDateTime::Now();
            OnAchievementUnlocked.Broadcast(Achievement);
        }
    }
}

void UMT_RankingSystem::UpdatePlayerTitle()
{
    float TotalScore = CalculateOverallScore();

    if (TotalScore >= 50000)
    {
        CurrentPlayerTitle = "榫卯大师";
    }
    else if (TotalScore >= 30000)
    {
        CurrentPlayerTitle = "木工宗师";
    }
    else if (TotalScore >= 20000)
    {
        CurrentPlayerTitle = "建筑泰斗";
    }
    else if (TotalScore >= 10000)
    {
        CurrentPlayerTitle = "高级工匠";
    }
    else if (TotalScore >= 5000)
    {
        CurrentPlayerTitle = "熟练工匠";
    }
    else if (TotalScore >= 2000)
    {
        CurrentPlayerTitle = "进阶学徒";
    }
    else
    {
        CurrentPlayerTitle = "榫卯学徒";
    }
}

float UMT_RankingSystem::CalculateOverallScore() const
{
    float KnowledgeWeight = 0.4f;
    float CreativityWeight = 0.2f;
    float AccuracyWeight = 0.2f;
    float CollectionWeight = 0.2f;

    float KnowledgeScore = PlayerStats.TotalKnowledgeScore;
    float CreativityScore = PlayerStats.CustomBuildsCreated * 100 + PlayerStats.BuildLikesReceived * 50;
    float AccuracyScore = PlayerStats.TotalPartsPlaced > 0
        ? (float)PlayerStats.PerfectPlacements / PlayerStats.TotalPartsPlaced * 1000
        : 0;
    float CollectionScore = PlayerStats.PartsUnlocked * 100;

    return KnowledgeScore * KnowledgeWeight +
           CreativityScore * CreativityWeight +
           AccuracyScore * AccuracyWeight +
           CollectionScore * CollectionWeight;
}
