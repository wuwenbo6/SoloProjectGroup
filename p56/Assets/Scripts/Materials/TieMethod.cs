using UnityEngine;
using System.Collections.Generic;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "NewTieMethod", menuName = "TieDye/TieMethod")]
    public class TieMethod : ScriptableObject
    {
        [Header("捆扎方式信息")]
        public string methodName;
        [TextArea]
        public string description;
        public Sprite tutorialImage;
        public int difficultyLevel = 1;

        [Header("捆扎效果参数")]
        public float blockRadius = 0.05f;
        public PatternType patternType;

        [Header("预设阻挡点（UV坐标）")]
        public List<Vector2> blockPoints = new List<Vector2>();

        [Header("解锁条件")]
        public bool isUnlockedByDefault = true;
        public int requiredLevel = 0;

        [Header("工艺知识")]
        [TextArea]
        public string craftKnowledge;
        public string originRegion;

        public List<Vector2> GeneratePatternPoints(int complexity = 1)
        {
            List<Vector2> points = new List<Vector2>();

            switch (patternType)
            {
                case PatternType.Fold:
                    points = GenerateFoldPattern(complexity);
                    break;
                case PatternType.Spiral:
                    points = GenerateSpiralPattern(complexity);
                    break;
                case PatternType.Circle:
                    points = GenerateCirclePattern(complexity);
                    break;
                case PatternType.Stripe:
                    points = GenerateStripePattern(complexity);
                    break;
                case PatternType.Custom:
                    points = new List<Vector2>(blockPoints);
                    break;
            }

            return points;
        }

        private List<Vector2> GenerateFoldPattern(int complexity)
        {
            List<Vector2> points = new List<Vector2>();
            int lines = 2 + complexity;

            for (int i = 0; i < lines; i++)
            {
                float y = (float)(i + 1) / (lines + 1);
                for (int x = 0; x < 20; x++)
                {
                    points.Add(new Vector2((float)x / 19f, y));
                }
            }

            return points;
        }

        private List<Vector2> GenerateSpiralPattern(int complexity)
        {
            List<Vector2> points = new List<Vector2>();
            int arms = 2 + complexity;
            float turns = 1.5f + complexity * 0.5f;
            int pointsPerArm = 30 + complexity * 10;

            Vector2 center = new Vector2(0.5f, 0.5f);

            for (int arm = 0; arm < arms; arm++)
            {
                float startAngle = (float)arm / arms * Mathf.PI * 2;

                for (int i = 0; i < pointsPerArm; i++)
                {
                    float t = (float)i / pointsPerArm;
                    float angle = startAngle + t * turns * Mathf.PI * 2;
                    float radius = t * 0.45f;
                    Vector2 point = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
                    points.Add(point);
                }
            }

            return points;
        }

        private List<Vector2> GenerateCirclePattern(int complexity)
        {
            List<Vector2> points = new List<Vector2>();
            int circles = 1 + complexity;
            int pointsPerCircle = 12 + complexity * 6;

            Vector2 center = new Vector2(0.5f, 0.5f);

            for (int c = 0; c < circles; c++)
            {
                float radius = 0.1f + c * 0.15f;

                for (int i = 0; i < pointsPerCircle; i++)
                {
                    float angle = (float)i / pointsPerCircle * Mathf.PI * 2;
                    Vector2 point = center + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * radius;
                    points.Add(point);
                }
            }

            return points;
        }

        private List<Vector2> GenerateStripePattern(int complexity)
        {
            List<Vector2> points = new List<Vector2>();
            int stripes = 3 + complexity * 2;
            bool horizontal = Random.value > 0.5f;

            for (int s = 0; s < stripes; s++)
            {
                float pos = (float)(s + 1) / (stripes + 1);

                for (int i = 0; i < 30; i++)
                {
                    if (horizontal)
                    {
                        points.Add(new Vector2((float)i / 29f, pos));
                    }
                    else
                    {
                        points.Add(new Vector2(pos, (float)i / 29f));
                    }
                }
            }

            return points;
        }
    }

    public enum PatternType
    {
        Fold,
        Spiral,
        Circle,
        Stripe,
        Custom
    }
}
