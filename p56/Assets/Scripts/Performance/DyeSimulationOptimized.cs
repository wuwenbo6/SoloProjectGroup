using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Performance
{
    [RequireComponent(typeof(Renderer))]
    public class DyeSimulationOptimized : Singleton<DyeSimulationOptimized>
    {
        [Header("模拟设置")]
        public int simulationResolution = 512;
        public SimulationQuality quality = SimulationQuality.Medium;
        public bool useGPUAcceleration = true;
        public bool enableAdaptiveLOD = true;

        [Header("性能参数")]
        public int diffusionSteps = 5;
        public float diffusionRate = 0.15f;
        public float evaporationRate = 0.01f;
        public float updateInterval = 0.033f;

        [Header("统计信息")]
        public float avgFrameTime = 0f;
        public int totalDrops = 0;
        public int activeCells = 0;
        public bool isOptimizedMode = false;

        private RenderTexture dyeTextureA;
        private RenderTexture dyeTextureB;
        private RenderTexture velocityTexture;
        private Material diffusionMaterial;
        private Material colorMixMaterial;

        private Color32[,] dyeGridCPU;
        private float[,] concentrationGrid;
        private bool[,] activeCellMask;
        private Queue<PendingDye> pendingDyeDrops = new Queue<PendingDye>();

        private ComputeShader diffusionCompute;
        private int diffusionKernel;
        private int clearKernel;

        private List<SimulationChunk> chunks = new List<SimulationChunk>();
        private int chunkSize = 32;
        private float lastUpdateTime = 0f;
        private float frameTimeAccumulator = 0f;
        private int frameCounter = 0;

        private Coroutine simulationCoroutine;
        private bool isSimulationPaused = false;

        public System.Action OnSimulationStart;
        public System.Action OnSimulationPause;
        public System.Action<int> OnChunkUpdate;

        private new void Awake()
        {
            base.Awake();
            InitializeSimulation();
        }

        private void Start()
        {
            CreateChunks();
            StartSimulation();
        }

        private void InitializeSimulation()
        {
            ApplyQualitySettings();

            if (useGPUAcceleration && SystemInfo.supportsComputeShaders)
            {
                InitializeGPU();
            }
            else
            {
                useGPUAcceleration = false;
                InitializeCPU();
            }

            Debug.Log($"[模拟优化] 初始化完成: {(useGPUAcceleration ? "GPU加速" : "CPU模式")}, 分辨率: {simulationResolution}");
        }

        private void ApplyQualitySettings()
        {
            switch (quality)
            {
                case SimulationQuality.Low:
                    simulationResolution = 256;
                    diffusionSteps = 2;
                    updateInterval = 0.05f;
                    break;
                case SimulationQuality.Medium:
                    simulationResolution = 512;
                    diffusionSteps = 5;
                    updateInterval = 0.033f;
                    break;
                case SimulationQuality.High:
                    simulationResolution = 1024;
                    diffusionSteps = 8;
                    updateInterval = 0.016f;
                    break;
                case SimulationQuality.Ultra:
                    simulationResolution = 2048;
                    diffusionSteps = 12;
                    updateInterval = 0.008f;
                    break;
            }

            isOptimizedMode = quality <= SimulationQuality.Medium;
            chunkSize = simulationResolution / 16;
        }

        private void InitializeGPU()
        {
            RenderTextureFormat format = RenderTextureFormat.ARGB32;

            dyeTextureA = new RenderTexture(simulationResolution, simulationResolution, 0, format);
            dyeTextureA.enableRandomWrite = true;
            dyeTextureA.Create();

            dyeTextureB = new RenderTexture(simulationResolution, simulationResolution, 0, format);
            dyeTextureB.enableRandomWrite = true;
            dyeTextureB.Create();

            velocityTexture = new RenderTexture(simulationResolution, simulationResolution, 0, RenderTextureFormat.RGFloat);
            velocityTexture.enableRandomWrite = true;
            velocityTexture.Create();

            Shader diffusionShader = Shader.Find("Hidden/Diffusion");
            if (diffusionShader != null)
            {
                diffusionMaterial = new Material(diffusionShader);
            }

            Shader colorShader = Shader.Find("Hidden/ColorMix");
            if (colorShader != null)
            {
                colorMixMaterial = new Material(colorShader);
            }

            Renderer renderer = GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.mainTexture = dyeTextureA;
            }
        }

        private void InitializeCPU()
        {
            dyeGridCPU = new Color32[simulationResolution, simulationResolution];
            concentrationGrid = new float[simulationResolution, simulationResolution];
            activeCellMask = new bool[simulationResolution / 4, simulationResolution / 4];

            for (int x = 0; x < simulationResolution; x++)
            {
                for (int y = 0; y < simulationResolution; y++)
                {
                    dyeGridCPU[x, y] = new Color32(255, 255, 255, 0);
                    concentrationGrid[x, y] = 0f;
                }
            }

            Texture2D cpuTexture = new Texture2D(simulationResolution, simulationResolution, TextureFormat.ARGB32, false);
            Renderer renderer = GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.mainTexture = cpuTexture;
            }
        }

        private void CreateChunks()
        {
            chunks.Clear();
            int chunksX = simulationResolution / chunkSize;
            int chunksY = simulationResolution / chunkSize;

            for (int x = 0; x < chunksX; x++)
            {
                for (int y = 0; y < chunksY; y++)
                {
                    chunks.Add(new SimulationChunk
                    {
                        startX = x * chunkSize,
                        startY = y * chunkSize,
                        size = chunkSize,
                        isActive = false,
                        lastUpdateFrame = 0
                    });
                }
            }

            Debug.Log($"[模拟优化] 创建分块: {chunks.Count} 个, 每块 {chunkSize}x{chunkSize}");
        }

        public void StartSimulation()
        {
            if (simulationCoroutine != null)
            {
                StopCoroutine(simulationCoroutine);
            }

            isSimulationPaused = false;
            simulationCoroutine = StartCoroutine(SimulationLoop());
            OnSimulationStart?.Invoke();
        }

        public void PauseSimulation()
        {
            isSimulationPaused = true;
            OnSimulationPause?.Invoke();
        }

        private IEnumerator SimulationLoop()
        {
            while (true)
            {
                if (!isSimulationPaused && Time.time - lastUpdateTime >= updateInterval)
                {
                    float startTime = Time.realtimeSinceStartup;

                    ProcessPendingDyeDrops();

                    if (useGPUAcceleration)
                    {
                        RunGPUSimulation();
                    }
                    else
                    {
                        RunCPUSimulation();
                    }

                    UpdateChunks();

                    lastUpdateTime = Time.time;
                    float frameTime = (Time.realtimeSinceStartup - startTime) * 1000f;

                    frameTimeAccumulator += frameTime;
                    frameCounter++;

                    if (frameCounter >= 30)
                    {
                        avgFrameTime = frameTimeAccumulator / frameCounter;
                        frameTimeAccumulator = 0f;
                        frameCounter = 0;

                        if (enableAdaptiveLOD)
                        {
                            AdaptiveQualityAdjustment();
                        }
                    }
                }

                yield return null;
            }
        }

        private void ProcessPendingDyeDrops()
        {
            while (pendingDyeDrops.Count > 0)
            {
                PendingDye dye = pendingDyeDrops.Dequeue();
                ApplyDyeInternal(dye.position, dye.radius, dye.color, dye.concentration);
                totalDrops++;
            }
        }

        private void RunGPUSimulation()
        {
            if (diffusionMaterial == null) return;

            diffusionMaterial.SetFloat("_DiffusionRate", diffusionRate);
            diffusionMaterial.SetFloat("_EvaporationRate", evaporationRate);

            for (int i = 0; i < diffusionSteps; i++)
            {
                Graphics.Blit(dyeTextureA, dyeTextureB, diffusionMaterial);
                (dyeTextureA, dyeTextureB) = (dyeTextureB, dyeTextureA);
            }
        }

        private void RunCPUSimulation()
        {
            int gridSize = simulationResolution;
            float diffusionFactor = diffusionRate * 0.2f;

            for (int step = 0; step < diffusionSteps; step++)
            {
                for (int x = 1; x < gridSize - 1; x++)
                {
                    for (int y = 1; y < gridSize - 1; y++)
                    {
                        Color32 current = dyeGridCPU[x, y];
                        float currentConc = concentrationGrid[x, y];

                        if (currentConc < 0.01f) continue;

                        Color32 up = dyeGridCPU[x, y + 1];
                        Color32 down = dyeGridCPU[x, y - 1];
                        Color32 left = dyeGridCPU[x - 1, y];
                        Color32 right = dyeGridCPU[x + 1, y];

                        float avgR = (up.r + down.r + left.r + right.r) * 0.25f;
                        float avgG = (up.g + down.g + left.g + right.g) * 0.25f;
                        float avgB = (up.b + down.b + left.b + right.b) * 0.25f;

                        float newR = Mathf.Lerp(current.r, avgR, diffusionFactor);
                        float newG = Mathf.Lerp(current.g, avgG, diffusionFactor);
                        float newB = Mathf.Lerp(current.b, avgB, diffusionFactor);

                        dyeGridCPU[x, y] = new Color32(
                            (byte)Mathf.Clamp(newR, 0, 255),
                            (byte)Mathf.Clamp(newG, 0, 255),
                            (byte)Mathf.Clamp(newB, 0, 255),
                            current.a
                        );

                        concentrationGrid[x, y] = currentConc * (1f - evaporationRate);
                    }
                }
            }

            UpdateCPUTexture();
        }

        private void UpdateCPUTexture()
        {
            Renderer renderer = GetComponent<Renderer>();
            if (renderer == null || renderer.material.mainTexture == null) return;

            Texture2D texture = (Texture2D)renderer.material.mainTexture;
            Color32[] pixels = new Color32[simulationResolution * simulationResolution];

            int activeCount = 0;

            for (int x = 0; x < simulationResolution; x++)
            {
                for (int y = 0; y < simulationResolution; y++)
                {
                    pixels[y * simulationResolution + x] = dyeGridCPU[x, y];
                    if (concentrationGrid[x, y] > 0.01f) activeCount++;
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply();

            activeCells = activeCount;
        }

        private void UpdateChunks()
        {
            int activeChunks = 0;
            int frame = Time.frameCount;

            foreach (SimulationChunk chunk in chunks)
            {
                if (CheckChunkActivity(chunk))
                {
                    chunk.isActive = true;
                    chunk.lastUpdateFrame = frame;
                    activeChunks++;
                }
                else if (frame - chunk.lastUpdateFrame > 60)
                {
                    chunk.isActive = false;
                }
            }

            OnChunkUpdate?.Invoke(activeChunks);
        }

        private bool CheckChunkActivity(SimulationChunk chunk)
        {
            if (useGPUAcceleration) return true;

            int sampleRate = 4;
            for (int x = chunk.startX; x < chunk.startX + chunk.size; x += sampleRate)
            {
                for (int y = chunk.startY; y < chunk.startY + chunk.size; y += sampleRate)
                {
                    if (concentrationGrid[x, y] > 0.05f)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private void AdaptiveQualityAdjustment()
        {
            float targetFPS = 60f;
            float currentFPS = 1000f / avgFrameTime;

            if (currentFPS < targetFPS * 0.7f)
            {
                if (quality > SimulationQuality.Low)
                {
                    quality--;
                    ApplyQualitySettings();
                    Debug.Log($"[模拟优化] 自动降质: {quality}, FPS: {currentFPS:F1}");
                }
            }
            else if (currentFPS > targetFPS * 1.2f && quality < SimulationQuality.High)
            {
                quality++;
                ApplyQualitySettings();
                Debug.Log($"[模拟优化] 自动升质: {quality}, FPS: {currentFPS:F1}");
            }
        }

        public void ApplyDye(Vector2 uvPosition, float radius, Color color, float concentration = 1f)
        {
            pendingDyeDrops.Enqueue(new PendingDye
            {
                position = uvPosition,
                radius = radius,
                color = color,
                concentration = concentration
            });
        }

        private void ApplyDyeInternal(Vector2 uvPosition, float radius, Color color, float concentration)
        {
            int centerX = Mathf.FloorToInt(uvPosition.x * simulationResolution);
            int centerY = Mathf.FloorToInt(uvPosition.y * simulationResolution);
            int radiusInt = Mathf.FloorToInt(radius * simulationResolution);

            if (useGPUAcceleration)
            {
                RenderTexture.active = dyeTextureA;
                GL.PushMatrix();
                GL.LoadPixelMatrix(0, simulationResolution, simulationResolution, 0);

                Texture2D tempTex = new Texture2D(radiusInt * 2 + 1, radiusInt * 2 + 1);
                Color[] pixels = tempTex.GetPixels();

                for (int dx = -radiusInt; dx <= radiusInt; dx++)
                {
                    for (int dy = -radiusInt; dy <= radiusInt; dy++)
                    {
                        float dist = Mathf.Sqrt(dx * dx + dy * dy) / radiusInt;
                        float falloff = Mathf.Max(0f, 1f - dist);
                        int idx = (dy + radiusInt) * (radiusInt * 2 + 1) + (dx + radiusInt);
                        pixels[idx] = color * falloff * concentration;
                    }
                }

                tempTex.SetPixels(pixels);
                tempTex.Apply();

                Graphics.CopyTexture(tempTex, 0, 0, 0, 0,
                    Mathf.Min(radiusInt * 2 + 1, simulationResolution - centerX),
                    Mathf.Min(radiusInt * 2 + 1, simulationResolution - centerY),
                    dyeTextureA, 0, 0,
                    Mathf.Max(0, centerX - radiusInt),
                    Mathf.Max(0, centerY - radiusInt));

                GL.PopMatrix();
                RenderTexture.active = null;
                Destroy(tempTex);
            }
            else
            {
                for (int dx = -radiusInt; dx <= radiusInt; dx++)
                {
                    for (int dy = -radiusInt; dy <= radiusInt; dy++)
                    {
                        int x = centerX + dx;
                        int y = centerY + dy;

                        if (x < 0 || x >= simulationResolution || y < 0 || y >= simulationResolution)
                            continue;

                        float dist = Mathf.Sqrt(dx * dx + dy * dy) / radiusInt;
                        float falloff = Mathf.Max(0f, 1f - dist * dist);
                        float amount = falloff * concentration;

                        Color32 current = dyeGridCPU[x, y];
                        Color newColor = Color.Lerp(current, color, amount);

                        dyeGridCPU[x, y] = newColor;
                        concentrationGrid[x, y] += amount;
                    }
                }
            }
        }

        public void ClearSimulation()
        {
            pendingDyeDrops.Clear();
            totalDrops = 0;
            activeCells = 0;

            if (useGPUAcceleration)
            {
                RenderTexture.active = dyeTextureA;
                GL.Clear(false, true, Color.white);
                RenderTexture.active = dyeTextureB;
                GL.Clear(false, true, Color.white);
                RenderTexture.active = null;
            }
            else
            {
                for (int x = 0; x < simulationResolution; x++)
                {
                    for (int y = 0; y < simulationResolution; y++)
                    {
                        dyeGridCPU[x, y] = new Color32(255, 255, 255, 0);
                        concentrationGrid[x, y] = 0f;
                    }
                }
                UpdateCPUTexture();
            }

            foreach (var chunk in chunks)
            {
                chunk.isActive = false;
            }

            Debug.Log("[模拟优化] 清除模拟");
        }

        public void SetQuality(SimulationQuality newQuality)
        {
            if (quality == newQuality) return;

            quality = newQuality;
            StopAllCoroutines();
            InitializeSimulation();
            CreateChunks();
            StartSimulation();
        }

        private void OnDestroy()
        {
            if (dyeTextureA != null) Destroy(dyeTextureA);
            if (dyeTextureB != null) Destroy(dyeTextureB);
            if (velocityTexture != null) Destroy(velocityTexture);
            if (diffusionMaterial != null) Destroy(diffusionMaterial);
            if (colorMixMaterial != null) Destroy(colorMixMaterial);
        }
    }

    public class PendingDye
    {
        public Vector2 position;
        public float radius;
        public Color color;
        public float concentration;
    }

    public class SimulationChunk
    {
        public int startX;
        public int startY;
        public int size;
        public bool isActive;
        public int lastUpdateFrame;
    }

    public enum SimulationQuality
    {
        Low,
        Medium,
        High,
        Ultra
    }
}
