using System;
using UnityEngine;

namespace TieDyeGame.Scoring
{
    [Serializable]
    public class WorkScore
    {
        public float totalScore;
        public float complexityScore;
        public float similarityScore;
        public float colorHarmonyScore;
        public float techniqueScore;
        public float creativityScore;
        public int starRating;
        public string grade;
    }

    public enum ScoreDimension
    {
        Complexity,
        Similarity,
        ColorHarmony,
        Technique,
        Creativity
    }

    public class WorkScorer : MonoBehaviour
    {
        [Header("Weight Settings")]
        [Range(0f, 1f)] public float complexityWeight = 0.2f;
        [Range(0f, 1f)] public float similarityWeight = 0.3f;
        [Range(0f, 1f)] public float colorHarmonyWeight = 0.2f;
        [Range(0f, 1f)] public float techniqueWeight = 0.15f;
        [Range(0f, 1f)] public float creativityWeight = 0.15f;

        [Header("Star Thresholds")]
        public float oneStarThreshold = 50f;
        public float twoStarThreshold = 70f;
        public float threeStarThreshold = 85f;
        public float fourStarThreshold = 95f;
        public float fiveStarThreshold = 99f;

        public WorkScore ScoreWork(Color[,] colorGrid, bool[,] tieMask, 
            int tieElementCount, float complexity, Texture2D targetPattern = null)
        {
            var score = new WorkScore();
            
            score.complexityScore = CalculateComplexityScore(tieElementCount, complexity, tieMask);
            score.similarityScore = targetPattern != null ? CalculateSimilarityScore(colorGrid, targetPattern) : 100f;
            score.colorHarmonyScore = CalculateColorHarmonyScore(colorGrid);
            score.techniqueScore = CalculateTechniqueScore(tieMask, colorGrid);
            score.creativityScore = CalculateCreativityScore(tieMask, colorGrid, tieElementCount);

            score.totalScore = 
                score.complexityScore * complexityWeight +
                score.similarityScore * similarityWeight +
                score.colorHarmonyScore * colorHarmonyScore +
                score.techniqueScore * techniqueWeight +
                score.creativityScore * creativityWeight;

            score.starRating = CalculateStarRating(score.totalScore);
            score.grade = CalculateGrade(score.totalScore);

            return score;
        }

        private float CalculateComplexityScore(int elementCount, float complexity, bool[,] tieMask)
        {
            var gridSize = tieMask.GetLength(0);
            var coveredPixels = 0;
            
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    if (tieMask[x, y]) coveredPixels++;
                }
            }

            var coverageRatio = (float)coveredPixels / (gridSize * gridSize);
            
            var elementScore = Mathf.Min(100f, elementCount * 5f);
            var complexityScore = Mathf.Min(100f, complexity);
            var coverageScore = coverageRatio * 100f;
            
            return (elementScore * 0.4f + complexityScore * 0.4f + coverageScore * 0.2f);
        }

        private float CalculateSimilarityScore(Color[,] colorGrid, Texture2D target)
        {
            var width = Math.Min(colorGrid.GetLength(0), target.width);
            var height = Math.Min(colorGrid.GetLength(1), target.height);
            var totalSimilarity = 0f;
            var pixelCount = 0;

            for (var x = 0; x < width; x++)
            {
                for (var y = 0; y < height; y++)
                {
                    var targetPixel = target.GetPixel(x, y);
                    var playerPixel = colorGrid[x, y];
                    
                    var hueDiff = Mathf.Abs(GetHue(targetPixel) - GetHue(playerPixel));
                    hueDiff = Mathf.Min(hueDiff, 1f - hueDiff);
                    var satDiff = Mathf.Abs(targetPixel.grayscale - playerPixel.grayscale);
                    var valDiff = Mathf.Abs(targetPixel.r - playerPixel.r);
                    
                    var pixelSimilarity = 1f - (hueDiff * 0.5f + satDiff * 0.3f + valDiff * 0.2f);
                    totalSimilarity += Mathf.Max(0, pixelSimilarity * 100f);
                    pixelCount++;
                }
            }

            return pixelCount > 0 ? totalSimilarity / pixelCount : 0f;
        }

        private float GetHue(Color color)
        {
            Color.RGBToHSV(color, out var h, out _, out _);
            return h;
        }

        private float CalculateColorHarmonyScore(Color[,] colorGrid)
        {
            var dominantColors = GetDominantColors(colorGrid, 5);
            
            if (dominantColors.Length < 2) return 100f;

            var harmonyScore = 0f;
            var comparisonCount = 0;

            for (var i = 0; i < dominantColors.Length; i++)
            {
                for (var j = i + 1; j < dominantColors.Length; j++)
                {
                    harmonyScore += CalculateColorPairHarmony(dominantColors[i], dominantColors[j]);
                    comparisonCount++;
                }
            }

            return comparisonCount > 0 ? harmonyScore / comparisonCount : 80f;
        }

        private Color[] GetDominantColors(Color[,] colorGrid, int count)
        {
            var width = colorGrid.GetLength(0);
            var height = colorGrid.GetLength(1);
            var colorBins = new System.Collections.Generic.Dictionary<int, int>();

            for (var x = 0; x < width; x += 4)
            {
                for (var y = 0; y < height; y += 4)
                {
                    var color = colorGrid[x, y];
                    var bin = GetColorBin(color);
                    colorBins[bin] = colorBins.TryGetValue(bin, out var value) ? value + 1 : 1;
                }
            }

            var sortedBins = new System.Collections.Generic.List<KeyValuePair<int, int>>(colorBins);
            sortedBins.Sort((a, b) => b.Value.CompareTo(a.Value));

            var dominantColors = new Color[Math.Min(count, sortedBins.Count)];
            for (var i = 0; i < dominantColors.Length; i++)
            {
                dominantColors[i] = GetColorFromBin(sortedBins[i].Key);
            }

            return dominantColors;
        }

        private int GetColorBin(Color color)
        {
            Color.RGBToHSV(color, out var h, out var s, out var v);
            var hueBin = Mathf.FloorToInt(h * 12f);
            var satBin = Mathf.FloorToInt(s * 3f);
            var valBin = Mathf.FloorToInt(v * 3f);
            return hueBin * 9 + satBin * 3 + valBin;
        }

        private Color GetColorFromBin(int bin)
        {
            var hueBin = bin / 9;
            var satBin = (bin % 9) / 3;
            var valBin = bin % 3;
            
            var h = (hueBin + 0.5f) / 12f;
            var s = (satBin + 0.5f) / 3f;
            var v = (valBin + 0.5f) / 3f;
            
            return Color.HSVToRGB(h, s, v);
        }

        private float CalculateColorPairHarmony(Color c1, Color c2)
        {
            Color.RGBToHSV(c1, out var h1, out var s1, out var v1);
            Color.RGBToHSV(c2, out var h2, out var s2, out var v2);

            var hueDiff = Mathf.Abs(h1 - h2);
            hueDiff = Mathf.Min(hueDiff, 1f - hueDiff);

            float harmonyScore;
            
            if (hueDiff < 0.05f)
            {
                harmonyScore = 90f;
            }
            else if (hueDiff is > 0.28f and < 0.38f)
            {
                harmonyScore = 95f;
            }
            else if (hueDiff is > 0.45f and < 0.55f)
            {
                harmonyScore = 85f;
            }
            else if (hueDiff is > 0.6f and < 0.7f)
            {
                harmonyScore = 75f;
            }
            else
            {
                harmonyScore = 60f;
            }

            var satDiff = Mathf.Abs(s1 - s2);
            var valDiff = Mathf.Abs(v1 - v2);
            harmonyScore *= 1f - (satDiff * 0.2f + valDiff * 0.1f);

            return Mathf.Max(0f, harmonyScore);
        }

        private float CalculateTechniqueScore(bool[,] tieMask, Color[,] colorGrid)
        {
            var gridSize = tieMask.GetLength(0);
            var edgeScore = 0f;
            var edgeCount = 0;

            for (var x = 1; x < gridSize - 1; x++)
            {
                for (var y = 1; y < gridSize - 1; y++)
                {
                    if (!tieMask[x, y]) continue;

                    var hasNonTieNeighbor = false;
                    for (var dx = -1; dx <= 1; dx++)
                    {
                        for (var dy = -1; dy <= 1; dy++)
                        {
                            if (!tieMask[x + dx, y + dy])
                            {
                                hasNonTieNeighbor = true;
                                break;
                            }
                        }
                        if (hasNonTieNeighbor) break;
                    }

                    if (hasNonTieNeighbor)
                    {
                        edgeScore += CalculateEdgeSharpness(colorGrid, x, y, gridSize);
                        edgeCount++;
                    }
                }
            }

            return edgeCount > 0 ? edgeScore / edgeCount * 100f : 70f;
        }

        private float CalculateEdgeSharpness(Color[,] colorGrid, int x, int y, int gridSize)
        {
            var centerColor = colorGrid[x, y];
            var maxDiff = 0f;

            for (var dx = -2; dx <= 2; dx++)
            {
                for (var dy = -2; dy <= 2; dy++)
                {
                    var nx = x + dx;
                    var ny = y + dy;
                    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

                    var neighborColor = colorGrid[nx, ny];
                    var diff = Vector4.Distance(
                        new Vector4(centerColor.r, centerColor.g, centerColor.b, centerColor.a),
                        new Vector4(neighborColor.r, neighborColor.g, neighborColor.b, neighborColor.a)
                    );
                    maxDiff = Mathf.Max(maxDiff, diff);
                }
            }

            return Mathf.Min(1f, maxDiff);
        }

        private float CalculateCreativityScore(bool[,] tieMask, Color[,] colorGrid, int elementCount)
        {
            var creativityScore = 0f;
            
            creativityScore += Mathf.Min(30f, elementCount * 2f);
            
            var patternVariety = CalculatePatternVariety(tieMask);
            creativityScore += patternVariety * 40f;
            
            var colorVariety = CalculateColorVariety(colorGrid);
            creativityScore += colorVariety * 30f;

            return creativityScore;
        }

        private float CalculatePatternVariety(bool[,] tieMask)
        {
            var gridSize = tieMask.GetLength(0);
            var quadrantMask = new bool[4];
            var halfSize = gridSize / 2;

            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    if (!tieMask[x, y]) continue;
                    
                    var quadrant = (x < halfSize ? 0 : 1) + (y < halfSize ? 0 : 2);
                    quadrantMask[quadrant] = true;
                }
            }

            var coveredQuadrants = 0;
            foreach (var q in quadrantMask)
            {
                if (q) coveredQuadrants++;
            }

            return coveredQuadrants / 4f;
        }

        private float CalculateColorVariety(Color[,] colorGrid)
        {
            var colorSet = new System.Collections.Generic.HashSet<int>();
            var width = colorGrid.GetLength(0);
            var height = colorGrid.GetLength(1);

            for (var x = 0; x < width; x += 8)
            {
                for (var y = 0; y < height; y += 8)
                {
                    colorSet.Add(GetColorBin(colorGrid[x, y]));
                }
            }

            return Mathf.Min(1f, colorSet.Count / 20f);
        }

        private int CalculateStarRating(float totalScore)
        {
            if (totalScore >= fiveStarThreshold) return 5;
            if (totalScore >= fourStarThreshold) return 4;
            if (totalScore >= threeStarThreshold) return 3;
            if (totalScore >= twoStarThreshold) return 2;
            if (totalScore >= oneStarThreshold) return 1;
            return 0;
        }

        private string CalculateGrade(float totalScore)
        {
            switch (totalScore)
            {
                case >= 95f: return "S+";
                case >= 90f: return "S";
                case >= 85f: return "A+";
                case >= 80f: return "A";
                case >= 75f: return "B+";
                case >= 70f: return "B";
                case >= 60f: return "C";
                default: return "D";
            }
        }

        public string GetDimensionName(ScoreDimension dimension)
        {
            return dimension switch
            {
                ScoreDimension.Complexity => "工艺复杂度",
                ScoreDimension.Similarity => "效果还原度",
                ScoreDimension.ColorHarmony => "色彩和谐度",
                ScoreDimension.Technique => "技法熟练度",
                ScoreDimension.Creativity => "创意表现力",
                _ => ""
            };
        }
    }
}