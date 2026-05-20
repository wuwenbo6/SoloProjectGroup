using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.MortiseTenon;

namespace MortiseTenonGame.Levels
{
    public enum LevelDifficulty
    {
        Beginner,
        Easy,
        Medium,
        Hard,
        Expert
    }

    [System.Serializable]
    public class LevelPieceData
    {
        public string PieceId;
        public PieceType PieceType;
        public Vector3 SpawnPosition;
        public Vector3 SpawnRotation;
        public Vector3 TargetPosition;
        public Vector3 TargetRotation;
    }

    [System.Serializable]
    public class LevelData
    {
        public int LevelId;
        public string LevelName;
        public LevelDifficulty Difficulty;
        [TextArea]
        public string Description;
        public int TimeLimit;
        public int BaseScore;
        public List<LevelPieceData> Pieces;
        public string KnowledgeId;
    }
}