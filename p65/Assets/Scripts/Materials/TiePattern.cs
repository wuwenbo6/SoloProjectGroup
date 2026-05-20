using UnityEngine;

namespace TieDyeGame.Materials
{
    public abstract class TiePattern : ScriptableObject
    {
        public string patternName;
        public Sprite previewIcon;
        [TextArea] public string description;
        public int difficultyLevel;

        public abstract void ApplyToMask(bool[,] mask, int gridSize);
    }
}