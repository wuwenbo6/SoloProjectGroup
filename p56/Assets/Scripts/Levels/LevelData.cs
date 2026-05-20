using UnityEngine;
using System.Collections.Generic;

namespace TieDyeGame.Levels
{
    [CreateAssetMenu(fileName = "NewLevel", menuName = "TieDye/Level")]
    public class LevelData : ScriptableObject
    {
        [Header("关卡基本信息")]
        public int levelId;
        public string levelName;
        [TextArea]
        public string description;
        public Sprite levelIcon;

        [Header("难度设置")]
        public int difficultyLevel = 1;
        public int minStarsToUnlock = 0;

        [Header("关卡目标")]
        public List<LevelObjective> objectives = new List<LevelObjective>();

        [Header("可用素材限制")]
        public List<string> availableFabrics = new List<string>();
        public List<string> availableDyes = new List<string>();
        public List<string> availableTieMethods = new List<string>();

        [Header("时间限制")]
        public float timeLimit = 120f;

        [Header("评分标准")]
        public int scoreOneStar = 50;
        public int scoreTwoStar = 80;
        public int scoreThreeStar = 100;

        [Header("关卡提示")]
        [TextArea]
        public string levelTip;

        [Header("相关工艺知识")]
        public string relatedKnowledgeId;

        public bool IsUnlocked(int totalStars)
        {
            return totalStars >= minStarsToUnlock;
        }

        public int CalculateStars(int score)
        {
            if (score >= scoreThreeStar) return 3;
            if (score >= scoreTwoStar) return 2;
            if (score >= scoreOneStar) return 1;
            return 0;
        }
    }

    [System.Serializable]
    public class LevelObjective
    {
        public ObjectiveType type;
        public string description;
        public int targetValue;
        public int rewardStars;
    }

    public enum ObjectiveType
    {
        UseSpecificColors,
        UseSpecificTieMethod,
        AchieveColorCount,
        CompleteWithinTime,
        CreateSpecificPattern,
        NoObjective
    }
}
