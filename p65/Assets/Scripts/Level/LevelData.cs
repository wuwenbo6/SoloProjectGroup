using UnityEngine;
using TieDyeGame.Materials;

namespace TieDyeGame.Level
{
    [CreateAssetMenu(fileName = "LevelData", menuName = "TieDye/Level Data")]
    public class LevelData : ScriptableObject
    {
        [Header("Basic Info")]
        public int levelId;
        public string levelName;
        [TextArea] public string levelDescription;
        public Sprite levelIcon;
        public int difficultyStars = 1;
        
        [Header("Unlock Requirements")]
        public int requiredCompletedLevels = 0;
        public int requiredScore = 0;
        
        [Header("Level Constraints")]
        public float timeLimit = 120f;
        public int maxDyeApplications = 10;
        public int maxColorCount = 3;
        
        [Header("Available Content")]
        public FabricMaterial[] availableFabrics;
        public TiePattern[] availablePatterns;
        public Color[] availableColors;
        
        [Header("Target")]
        public Texture2D targetPattern;
        public float requiredSimilarity = 0.7f;
        
        [Header("Rewards")]
        public int coinsReward = 100;
        public int expReward = 50;
        public GameObject[] unlocksContent;
        
        [Header("Knowledge")]
        public string knowledgeTitle;
        [TextArea] public string knowledgeContent;
        public Sprite knowledgeImage;
    }
}