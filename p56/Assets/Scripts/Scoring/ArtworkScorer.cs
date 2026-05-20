using UnityEngine;
using System.Collections.Generic;

namespace TieDyeGame.Scoring
{
    public class ArtworkScorer : Singleton<ArtworkScorer>
    {
        [Header("评分权重")]
        public float colorVarietyWeight = 0.3f;
        public float patternIntegrityWeight = 0.3f;
        public float craftsmanshipWeight = 0.2f;
        public float diffusionBeautyWeight = 0.2f;

        [Header("评分参数")]
        public int colorSampleCount = 100;
        public float whiteThreshold = 0.9f;
        public float minColorDifference = 0.15f;

        public System.Action<ScoringResult> OnScoringComplete;

        public ScoringResult EvaluateArtwork(Texture2D artwork, bool hasAppliedTie, bool hasSimulatedDiffusion, float totalSimTime)
        {
            ScoringResult result = new ScoringResult();

            result.colorVarietyScore = CalculateColorVarietyScore(artwork);
            result.patternIntegrityScore = CalculatePatternIntegrityScore(artwork, hasAppliedTie);
            result.craftsmanshipScore = CalculateCraftsmanshipScore(hasAppliedTie, hasSimulatedDiffusion, totalSimTime);
            result.diffusionBeautyScore = CalculateDiffusionBeautyScore(artwork);

            result.totalScore = Mathf.RoundToInt(
                result.colorVarietyScore * colorVarietyWeight +
                result.patternIntegrityScore * patternIntegrityWeight +
                result.craftsmanshipScore * craftsmanshipWeight +
                result.diffusionBeautyScore * diffusionBeautyWeight
            );

            result.totalScore = Mathf.Clamp(result.totalScore, 0, 100);
            result.grade = GetGrade(result.totalScore);
            result.feedback = GetDetailedFeedback(result);

            OnScoringComplete?.Invoke(result);
            return result;
        }

        private int CalculateColorVarietyScore(Texture2D texture)
        {
            if (texture == null) return 0;

            HashSet<Color> distinctColors = new HashSet<Color>();
            int width = texture.width;
            int height = texture.height;

            for (int i = 0; i < colorSampleCount; i++)
            {
                int x = Random.Range(0, width);
                int y = Random.Range(0, height);
                Color color = texture.GetPixel(x, y);

                if (color.grayscale > whiteThreshold) continue;

                bool isNewColor = true;
                foreach (var existingColor in distinctColors)
                {
                    if (ColorDifference(color, existingColor) < minColorDifference)
                    {
                        isNewColor = false;
                        break;
                    }
                }

                if (isNewColor)
                {
                    distinctColors.Add(color);
                }
            }

            int colorCount = distinctColors.Count;
            int score = Mathf.Min(100, colorCount * 15);
            return score;
        }

        private int CalculatePatternIntegrityScore(Texture2D texture, bool hasAppliedTie)
        {
            if (!hasAppliedTie) return 0;

            if (texture == null) return 50;

            int whitePixels = 0;
            int totalPixels = 0;
            int width = texture.width;
            int height = texture.height;

            for (int i = 0; i < colorSampleCount; i++)
            {
                int x = Random.Range(0, width);
                int y = Random.Range(0, height);
                Color color = texture.GetPixel(x, y);

                if (color.grayscale > whiteThreshold)
                {
                    whitePixels++;
                }
                totalPixels++;
            }

            float whiteRatio = (float)whitePixels / totalPixels;

            if (whiteRatio > 0.05f && whiteRatio < 0.6f)
            {
                return 100;
            }
            else if (whiteRatio > 0.02f)
            {
                return 70;
            }
            else
            {
                return 40;
            }
        }

        private int CalculateCraftsmanshipScore(bool hasAppliedTie, bool hasSimulatedDiffusion, float totalSimTime)
        {
            int score = 0;

            if (hasAppliedTie) score += 40;
            if (hasSimulatedDiffusion) score += 30;

            if (totalSimTime > 3f)
                score += 15;
            else if (totalSimTime > 1f)
                score += 10;

            if (hasAppliedTie && hasSimulatedDiffusion)
                score += 15;

            return Mathf.Min(100, score);
        }

        private int CalculateDiffusionBeautyScore(Texture2D texture)
        {
            if (texture == null) return 50;

            int edgeCount = 0;
            int width = texture.width;
            int height = texture.height;
            int sampleSize = 50;

            for (int i = 0; i < sampleSize; i++)
            {
                int x = Random.Range(1, width - 1);
                int y = Random.Range(1, height - 1);

                Color center = texture.GetPixel(x, y);
                Color right = texture.GetPixel(x + 1, y);
                Color bottom = texture.GetPixel(x, y + 1);

                float diff1 = ColorDifference(center, right);
                float diff2 = ColorDifference(center, bottom);

                if (diff1 > 0.1f && diff1 < 0.5f) edgeCount++;
                if (diff2 > 0.1f && diff2 < 0.5f) edgeCount++;
            }

            float edgeRatio = (float)edgeCount / (sampleSize * 2);

            if (edgeRatio > 0.3f && edgeRatio < 0.7f)
            {
                return 100;
            }
            else if (edgeRatio > 0.2f)
            {
                return 75;
            }
            else
            {
                return 50;
            }
        }

        private float ColorDifference(Color a, Color b)
        {
            return Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b);
        }

        private string GetGrade(int score)
        {
            if (score >= 90) return "S";
            if (score >= 80) return "A";
            if (score >= 70) return "B";
            if (score >= 60) return "C";
            return "D";
        }

        private string GetDetailedFeedback(ScoringResult result)
        {
            List<string> feedbacks = new List<string>();

            if (result.colorVarietyScore >= 80)
                feedbacks.Add("色彩丰富，层次分明！");
            else if (result.colorVarietyScore < 40)
                feedbacks.Add("尝试使用更多颜色搭配");

            if (result.patternIntegrityScore >= 70)
                feedbacks.Add("图案完整清晰，扎法到位！");
            else if (result.patternIntegrityScore == 0)
                feedbacks.Add("记得先捆扎再染色哦");

            if (result.craftsmanshipScore >= 80)
                feedbacks.Add("工艺完整，体现传统扎染精髓！");

            if (result.diffusionBeautyScore >= 75)
                feedbacks.Add("扩散自然，晕染效果优美！");

            if (feedbacks.Count == 0)
                feedbacks.Add("继续努力，下次一定更好！");

            return string.Join("\n", feedbacks);
        }
    }

    public class ScoringResult
    {
        public int colorVarietyScore;
        public int patternIntegrityScore;
        public int craftsmanshipScore;
        public int diffusionBeautyScore;
        public int totalScore;
        public string grade;
        public string feedback;
    }
}
