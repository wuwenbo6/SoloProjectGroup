#include "Save/MT_SaveGame.h"

UMT_SaveGame::UMT_SaveGame()
{
    PlayerName = TEXT("玩家");
    TotalStars = 0;
    TotalPlayTime = 0.0f;
    CurrentLevelID = 1;
    bHasSeenTutorial = false;
}
