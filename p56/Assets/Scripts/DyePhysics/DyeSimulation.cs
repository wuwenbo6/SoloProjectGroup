using UnityEngine;
using System.Collections.Generic;

namespace TieDyeGame.DyePhysics
{
    public class DyeSimulation : MonoBehaviour
    {
        [Header("模拟参数")]
        public int textureSize = 512;
        public float diffusionRate = 0.08f;
        public float absorptionRate = 0.05f;
        public float evaporationRate = 0.005f;
        public float colorSaturation = 1.3f;
        public float concentrationStrength = 1.0f;

        [Header("高级扩散参数")]
        public float edgeSoftness = 0.3f;
        public float colorBlendFactor = 0.7f;
        public float capillaryFlowStrength = 0.15f;
        public int diffusionIterations = 2;

        [Header("性能优化")]
        public int simulationFrameInterval = 2;
        public int textureUpdateInterval = 4;

        [Header("布料参数")]
        public float fabricDensity = 1.0f;

        private Texture2D dyeTexture;
        private Color[,] dyeGrid;
        private float[,] moistureGrid;
        private bool[,] blockedGrid;
        private bool isSimulating = false;
        private int frameCounter = 0;

        public System.Action<Texture2D> OnTextureUpdated;
        public bool IsSimulating => isSimulating;

        private void Start()
        {
            InitializeSimulation();
        }

        public void InitializeSimulation()
        {
            dyeTexture = new Texture2D(textureSize, textureSize);
            dyeGrid = new Color[textureSize, textureSize];
            moistureGrid = new float[textureSize, textureSize];
            blockedGrid = new bool[textureSize, textureSize];

            Color white = Color.white;
            for (int x = 0; x < textureSize; x++)
            {
                for (int y = 0; y < textureSize; y++)
                {
                    dyeGrid[x, y] = white;
                    moistureGrid[x, y] = 0f;
                    blockedGrid[x, y] = false;
                    dyeTexture.SetPixel(x, y, white);
                }
            }
            dyeTexture.Apply();
            OnTextureUpdated?.Invoke(dyeTexture);
        }

        public void ApplyDye(Vector2 uvPosition, Color dyeColor, float radius, float strength, float concentration = 1f)
        {
            int centerX = Mathf.Clamp(Mathf.FloorToInt(uvPosition.x * textureSize), 0, textureSize - 1);
            int centerY = Mathf.Clamp(Mathf.FloorToInt(uvPosition.y * textureSize), 0, textureSize - 1);
            int pixelRadius = Mathf.Max(1, Mathf.FloorToInt(radius * textureSize));
            float effectiveConcentration = concentration * concentrationStrength;

            int startX = Mathf.Max(0, centerX - pixelRadius);
            int endX = Mathf.Min(textureSize - 1, centerX + pixelRadius);
            int startY = Mathf.Max(0, centerY - pixelRadius);
            int endY = Mathf.Min(textureSize - 1, centerY + pixelRadius);

            float radiusSquared = pixelRadius * pixelRadius;

            for (int x = startX; x <= endX; x++)
            {
                for (int y = startY; y <= endY; y++)
                {
                    if (blockedGrid[x, y]) continue;

                    int dx = x - centerX;
                    int dy = y - centerY;
                    float distanceSquared = dx * dx + dy * dy;

                    if (distanceSquared <= radiusSquared)
                    {
                        float normalizedDist = Mathf.Sqrt(distanceSquared) / pixelRadius;
                        float falloff = 1f - normalizedDist;
                        float softFalloff = falloff * falloff * (3f - 2f * falloff);
                        float influence = softFalloff * strength * effectiveConcentration;

                        Color currentColor = dyeGrid[x, y];
                        Color concentratedDye = ColorBlend(currentColor, dyeColor, 0.5f + effectiveConcentration * 0.4f);
                        dyeGrid[x, y] = Color.Lerp(currentColor, concentratedDye, influence);
                        moistureGrid[x, y] = Mathf.Min(1f, moistureGrid[x, y] + influence * 0.8f);
                    }
                }
            }
            UpdateTexture();
        }

        public void SetBlockedRegion(List<Vector2> blockedUVs, float radius)
        {
            foreach (Vector2 uv in blockedUVs)
            {
                int centerX = Mathf.FloorToInt(uv.x * textureSize);
                int centerY = Mathf.FloorToInt(uv.y * textureSize);
                int pixelRadius = Mathf.FloorToInt(radius * textureSize);

                for (int x = -pixelRadius; x <= pixelRadius; x++)
                {
                    for (int y = -pixelRadius; y <= pixelRadius; y++)
                    {
                        int px = centerX + x;
                        int py = centerY + y;

                        if (px >= 0 && px < textureSize && py >= 0 && py < textureSize)
                        {
                            float distance = Mathf.Sqrt(x * x + y * y) / pixelRadius;
                            if (distance <= 1f)
                            {
                                blockedGrid[px, py] = true;
                            }
                        }
                    }
                }
            }
        }

        public void ClearBlockedRegions()
        {
            for (int x = 0; x < textureSize; x++)
            {
                for (int y = 0; y < textureSize; y++)
                {
                    blockedGrid[x, y] = false;
                }
            }
        }

        public void StartSimulation()
        {
            isSimulating = true;
        }

        public void StopSimulation()
        {
            isSimulating = false;
        }

        public void StepSimulation(int steps = 1)
        {
            for (int i = 0; i < steps; i++)
            {
                DiffusionStep();
                EvaporationStep();
            }
            UpdateTexture();
        }

        private void DiffusionStep()
        {
            for (int iteration = 0; iteration < diffusionIterations; iteration++)
            {
                Color[,] newDyeGrid = (Color[,])dyeGrid.Clone();
                float[,] newMoistureGrid = (float[,])moistureGrid.Clone();
                float[,] gradientGrid = CalculateMoistureGradient();

                for (int x = 1; x < textureSize - 1; x++)
                {
                    for (int y = 1; y < textureSize - 1; y++)
                    {
                        if (blockedGrid[x, y]) continue;

                        Color currentColor = dyeGrid[x, y];
                        float currentMoisture = moistureGrid[x, y];

                        if (currentMoisture < 0.01f) continue;

                        ProcessPixelDiffusion(x, y, currentColor, currentMoisture, gradientGrid[x, y], newDyeGrid, newMoistureGrid);
                    }
                }

                ApplyEdgeSoftening(newDyeGrid);

                dyeGrid = newDyeGrid;
                moistureGrid = newMoistureGrid;
            }
        }

        private float[,] CalculateMoistureGradient()
        {
            float[,] gradient = new float[textureSize, textureSize];

            for (int x = 1; x < textureSize - 1; x++)
            {
                for (int y = 1; y < textureSize - 1; y++)
                {
                    float gradX = moistureGrid[x + 1, y] - moistureGrid[x - 1, y];
                    float gradY = moistureGrid[x, y + 1] - moistureGrid[x, y - 1];
                    gradient[x, y] = Mathf.Sqrt(gradX * gradX + gradY * gradY);
                }
            }

            return gradient;
        }

        private void ProcessPixelDiffusion(int x, int y, Color currentColor, float currentMoisture, float gradient, Color[,] newDyeGrid, float[,] newMoistureGrid)
        {
            Color totalInflow = Color.black;
            float totalMoistureInflow = 0f;
            float totalWeight = 0f;

            for (int dx = -1; dx <= 1; dx++)
            {
                for (int dy = -1; dy <= 1; dy++)
                {
                    if (dx == 0 && dy == 0) continue;
                    if (blockedGrid[x + dx, y + dy]) continue;

                    int nx = x + dx;
                    int ny = y + dy;

                    Color neighborColor = dyeGrid[nx, ny];
                    float neighborMoisture = moistureGrid[nx, ny];

                    float moistureDiff = neighborMoisture - currentMoisture;
                    float flowFactor = moistureDiff > 0 ? diffusionRate * moistureDiff : diffusionRate * 0.05f;

                    float distance = (dx == 0 || dy == 0) ? 1f : 1.414f;
                    flowFactor /= distance;

                    float capillaryBonus = 1f + gradient * capillaryFlowStrength;
                    flowFactor *= capillaryBonus;

                    if (flowFactor > 0)
                    {
                        float distanceFactor = 1f / (1f + distance * 0.5f);
                        Color blendedColor = ColorBlend(currentColor, neighborColor, colorBlendFactor);
                        totalInflow += blendedColor * flowFactor * distanceFactor;
                        totalMoistureInflow += neighborMoisture * flowFactor * distanceFactor;
                        totalWeight += flowFactor * distanceFactor;
                    }
                }
            }

            if (totalWeight > 0)
            {
                Color flowColor = totalInflow / totalWeight;
                float flowMoisture = totalMoistureInflow / totalWeight;

                float blendFactor = Mathf.Min(totalWeight * 0.5f, 0.35f);
                newDyeGrid[x, y] = Color.Lerp(currentColor, flowColor, blendFactor);
                newDyeGrid[x, y] = EnhanceSaturation(newDyeGrid[x, y]);

                newMoistureGrid[x, y] = Mathf.Lerp(currentMoisture, flowMoisture, blendFactor * 0.6f);
            }
        }

        private Color ColorBlend(Color baseColor, Color blendColor, float factor)
        {
            float r = baseColor.r + (blendColor.r - baseColor.r) * factor;
            float g = baseColor.g + (blendColor.g - baseColor.g) * factor;
            float b = baseColor.b + (blendColor.b - baseColor.b) * factor;

            r = Mathf.Pow(r, 0.95f);
            g = Mathf.Pow(g, 0.95f);
            b = Mathf.Pow(b, 0.95f);

            return new Color(r, g, b, 1f);
        }

        private void ApplyEdgeSoftening(Color[,] grid)
        {
            Color[,] tempGrid = (Color[,])grid.Clone();

            for (int x = 1; x < textureSize - 1; x++)
            {
                for (int y = 1; y < textureSize - 1; y++)
                {
                    if (blockedGrid[x, y]) continue;

                    Color avgColor = Color.black;
                    int count = 0;

                    for (int dx = -1; dx <= 1; dx++)
                    {
                        for (int dy = -1; dy <= 1; dy++)
                        {
                            if (blockedGrid[x + dx, y + dy]) continue;
                            avgColor += tempGrid[x + dx, y + dy];
                            count++;
                        }
                    }

                    if (count > 0)
                    {
                        avgColor /= count;
                        grid[x, y] = Color.Lerp(tempGrid[x, y], avgColor, edgeSoftness * 0.1f);
                    }
                }
            }
        }

        private Color EnhanceSaturation(Color color)
        {
            float max = Mathf.Max(color.r, color.g, color.b);
            float min = Mathf.Min(color.r, color.g, color.b);
            float delta = max - min;

            if (delta < 0.01f) return color;

            float h, s, v;
            Color.RGBToHSV(color, out h, out s, out v);
            s = Mathf.Min(1f, s * colorSaturation);
            v = Mathf.Min(1f, v * 1.05f);
            return Color.HSVToRGB(h, s, v);
        }

        private void EvaporationStep()
        {
            for (int x = 0; x < textureSize; x++)
            {
                for (int y = 0; y < textureSize; y++)
                {
                    moistureGrid[x, y] = Mathf.Max(0f, moistureGrid[x, y] - evaporationRate * Time.deltaTime);
                }
            }
        }

        private void UpdateTexture()
        {
            frameCounter++;
            if (frameCounter % textureUpdateInterval != 0) return;

            Color[] pixelData = new Color[textureSize * textureSize];
            System.Threading.Tasks.Parallel.For(0, textureSize, x =>
            {
                for (int y = 0; y < textureSize; y++)
                {
                    pixelData[y * textureSize + x] = dyeGrid[x, y];
                }
            });
            dyeTexture.SetPixels(pixelData);
            dyeTexture.Apply();
            OnTextureUpdated?.Invoke(dyeTexture);
        }

        public Texture2D GetResultTexture()
        {
            return dyeTexture;
        }

        public void ResetSimulation()
        {
            InitializeSimulation();
        }

        private void Update()
        {
            if (isSimulating)
            {
                frameCounter++;
                if (frameCounter % simulationFrameInterval == 0)
                {
                    StepSimulation(1);
                }
            }
        }

        private void OnDestroy()
        {
            if (dyeTexture != null)
            {
                Destroy(dyeTexture);
            }
        }
    }
}
