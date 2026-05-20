#include "Game/MT_LevelData.h"

AMT_LevelData::AMT_LevelData()
{
    PrimaryActorTick.bCanEverTick = false;
    LevelID = 1;
    LevelName = TEXT("入门关卡");
    LevelDescription = TEXT("学习基础的燕尾榫结构");
    Difficulty = EPartDifficulty::PD_Beginner;
    HistoricalContext = TEXT("燕尾榫是中国古代建筑中最基础的榫卯结构之一，广泛应用于家具和建筑连接。");
    TimeLimit = 300.0f;
    MaxHints = 5;
}
