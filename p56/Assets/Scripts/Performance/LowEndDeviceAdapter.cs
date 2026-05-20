using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Performance
{
    public class LowEndDeviceAdapter : Singleton<LowEndDeviceAdapter>
    {
        [Header("设备检测")]
        public DeviceTier currentTier = DeviceTier.MidRange;
        public bool autoDetectOnStartup = true;
        public float minFrameRateForTierDetection = 30f;

        [Header("质量设置")]
        public QualityPreset lowQualityPreset;
        public QualityPreset midQualityPreset;
        public QualityPreset highQualityPreset;

        [Header("动态分辨率")]
        public bool enableDynamicResolution = true;
        public float minResolutionScale = 0.5f;
        public float maxResolutionScale = 1.0f;
        public float resolutionAdjustInterval = 2f;

        [Header("特效开关")]
        public bool disableParticlesOnLowEnd = true;
        public bool disablePostProcessingOnLowEnd = true;
        public bool disableShadowsOnLowEnd = true;
        public bool disableAntiAliasingOnLowEnd = true;

        [Header("监控统计")]
        public float currentFPS = 60f;
        public float currentResolutionScale = 1f;
        public int activeParticleCount = 0;
        public bool isLowPowerMode = false;

        private float frameTimeAccumulator = 0f;
        private int frameCounter = 0f;
        private float lastResolutionAdjustTime = 0f;
        private List<ParticleSystem> trackedParticles = new List<ParticleSystem>();
        private List<Behaviour> trackedPostProcess = new List<Behaviour>();
        private Coroutine monitoringCoroutine;

        public System.Action<DeviceTier> OnTierChanged;
        public System.Action<float> OnResolutionChanged;
        public System.Action<bool> OnLowPowerModeChanged;

        private new void Awake()
        {
            base.Awake();
            InitializePresets();
        }

        private IEnumerator Start()
        {
            if (autoDetectOnStartup)
            {
                yield return new WaitForSeconds(0.5f);
                DetectDeviceTier();
            }

            StartMonitoring();
            TrackEffects();
        }

        private void InitializePresets()
        {
            lowQualityPreset = new QualityPreset
            {
                pixelLightCount = 1,
                shadowQuality = ShadowQuality.Disable,
                shadowResolution = ShadowResolution.Low,
                antiAliasing = 0,
                vSyncCount = 0,
                lodBias = 1.0f,
                particleRaycastBudget = 8,
                softParticles = false,
                softVegetation = false,
                realtimeReflectionProbes = false,
                billboardsFaceCameraPosition = false,
                resolutionScalingFixedDPIFactor = 0.75f
            };

            midQualityPreset = new QualityPreset
            {
                pixelLightCount = 2,
                shadowQuality = ShadowQuality.HardOnly,
                shadowResolution = ShadowResolution.Medium,
                antiAliasing = 2,
                vSyncCount = 1,
                lodBias = 2.0f,
                particleRaycastBudget = 16,
                softParticles = true,
                softVegetation = true,
                realtimeReflectionProbes = true,
                billboardsFaceCameraPosition = true,
                resolutionScalingFixedDPIFactor = 1.0f
            };

            highQualityPreset = new QualityPreset
            {
                pixelLightCount = 4,
                shadowQuality = ShadowQuality.All,
                shadowResolution = ShadowResolution.High,
                antiAliasing = 4,
                vSyncCount = 1,
                lodBias = 3.0f,
                particleRaycastBudget = 32,
                softParticles = true,
                softVegetation = true,
                realtimeReflectionProbes = true,
                billboardsFaceCameraPosition = true,
                resolutionScalingFixedDPIFactor = 1.0f
            };
        }

        public void DetectDeviceTier()
        {
            int systemMemory = SystemInfo.systemMemorySize;
            int processorCount = SystemInfo.processorCount;
            int graphicsMemory = SystemInfo.graphicsMemorySize;
            string graphicsDevice = SystemInfo.graphicsDeviceName.ToLower();

            DeviceTier detectedTier;

            if (systemMemory < 2048 || processorCount <= 2 || graphicsMemory < 512)
            {
                detectedTier = DeviceTier.LowEnd;
            }
            else if (systemMemory < 4096 || processorCount <= 4 || graphicsMemory < 1024)
            {
                detectedTier = DeviceTier.MidRange;
            }
            else
            {
                detectedTier = DeviceTier.HighEnd;
            }

#if UNITY_ANDROID || UNITY_IOS
            if (detectedTier == DeviceTier.HighEnd)
            {
                detectedTier = DeviceTier.MidRange;
            }
#endif

            if (detectedTier != currentTier)
            {
                currentTier = detectedTier;
                ApplyQualityForTier(currentTier);
                OnTierChanged?.Invoke(currentTier);
            }

            Debug.Log($"[设备适配] 检测完成: {currentTier}, 内存: {systemMemory}MB, CPU核数: {processorCount}, 显存: {graphicsMemory}MB");
        }

        public void ApplyQualityForTier(DeviceTier tier)
        {
            QualityPreset preset = GetPresetForTier(tier);
            ApplyQualityPreset(preset);
            ApplyEffectToggles(tier);
            UpdateResolutionForTier(tier);
        }

        private QualityPreset GetPresetForTier(DeviceTier tier)
        {
            switch (tier)
            {
                case DeviceTier.LowEnd:
                    return lowQualityPreset;
                case DeviceTier.MidRange:
                    return midQualityPreset;
                case DeviceTier.HighEnd:
                    return highQualityPreset;
                default:
                    return midQualityPreset;
            }
        }

        private void ApplyQualityPreset(QualityPreset preset)
        {
            QualitySettings.pixelLightCount = preset.pixelLightCount;
            QualitySettings.shadows = preset.shadowQuality;
            QualitySettings.shadowResolution = preset.shadowResolution;
            QualitySettings.antiAliasing = preset.antiAliasing;
            QualitySettings.vSyncCount = preset.vSyncCount;
            QualitySettings.lodBias = preset.lodBias;
            QualitySettings.particleRaycastBudget = preset.particleRaycastBudget;
            QualitySettings.softParticles = preset.softParticles;
            QualitySettings.softVegetation = preset.softVegetation;
            QualitySettings.realtimeReflectionProbes = preset.realtimeReflectionProbes;
            QualitySettings.billboardsFaceCameraPosition = preset.billboardsFaceCameraPosition;
            QualitySettings.resolutionScalingFixedDPIFactor = preset.resolutionScalingFixedDPIFactor;

            Debug.Log($"[设备适配] 应用质量预设: 像素光={preset.pixelLightCount}, 阴影={preset.shadowQuality}");
        }

        private void ApplyEffectToggles(DeviceTier tier)
        {
            bool isLowEnd = tier == DeviceTier.LowEnd;

            if (disableParticlesOnLowEnd)
            {
                foreach (ParticleSystem ps in trackedParticles)
                {
                    if (ps != null)
                    {
                        ParticleSystem.EmissionModule em = ps.emission;
                        em.enabled = !isLowEnd;
                    }
                }
                activeParticleCount = isLowEnd ? 0 : trackedParticles.Count;
            }

            if (disablePostProcessingOnLowEnd)
            {
                foreach (Behaviour pp in trackedPostProcess)
                {
                    if (pp != null)
                    {
                        pp.enabled = !isLowEnd;
                    }
                }
            }

            if (disableShadowsOnLowEnd)
            {
                Light[] lights = FindObjectsOfType<Light>();
                foreach (Light light in lights)
                {
                    if (light != null)
                    {
                        light.shadows = isLowEnd ? LightShadows.None : LightShadows.Hard;
                    }
                }
            }

            Debug.Log($"[设备适配] 特效设置: 粒子={!isLowEnd || !disableParticlesOnLowEnd}, 后处理={!isLowEnd || !disablePostProcessingOnLowEnd}");
        }

        private void UpdateResolutionForTier(DeviceTier tier)
        {
            switch (tier)
            {
                case DeviceTier.LowEnd:
                    currentResolutionScale = 0.6f;
                    break;
                case DeviceTier.MidRange:
                    currentResolutionScale = 0.8f;
                    break;
                case DeviceTier.HighEnd:
                    currentResolutionScale = 1.0f;
                    break;
            }

            ApplyResolutionScale(currentResolutionScale);
        }

        private void ApplyResolutionScale(float scale)
        {
            scale = Mathf.Clamp(scale, minResolutionScale, maxResolutionScale);

            if (enableDynamicResolution)
            {
                Screen.SetResolution(
                    Mathf.FloorToInt(Screen.currentResolution.width * scale),
                    Mathf.FloorToInt(Screen.currentResolution.height * scale),
                    Screen.fullScreen
                );
            }

            currentResolutionScale = scale;
            OnResolutionChanged?.Invoke(scale);
            Debug.Log($"[设备适配] 分辨率缩放: {scale:F2}");
        }

        private void TrackEffects()
        {
            trackedParticles.AddRange(FindObjectsOfType<ParticleSystem>());

            System.Type ppType = System.Type.GetType("UnityEngine.Rendering.PostProcessing.PostProcessVolume, Assembly-CSharp");
            if (ppType != null)
            {
                Component[] components = (Component[])FindObjectsOfType(ppType);
                foreach (Component comp in components)
                {
                    trackedPostProcess.Add(comp as Behaviour);
                }
            }

            Debug.Log($"[设备适配] 追踪效果: {trackedParticles.Count} 个粒子系统, {trackedPostProcess.Count} 个后处理");
        }

        private void StartMonitoring()
        {
            if (monitoringCoroutine != null)
            {
                StopCoroutine(monitoringCoroutine);
            }
            monitoringCoroutine = StartCoroutine(PerformanceMonitoringCoroutine());
        }

        private IEnumerator PerformanceMonitoringCoroutine()
        {
            while (true)
            {
                float startTime = Time.realtimeSinceStartup;

                yield return new WaitForSeconds(0.5f);

                frameCounter++;
                frameTimeAccumulator += Time.realtimeSinceStartup - startTime;

                if (frameCounter >= 5)
                {
                    float avgFrameTime = frameTimeAccumulator / frameCounter;
                    currentFPS = 1f / avgFrameTime;

                    frameTimeAccumulator = 0f;
                    frameCounter = 0;

                    if (enableDynamicResolution && Time.time - lastResolutionAdjustTime >= resolutionAdjustInterval)
                    {
                        AdjustResolutionDynamically();
                        lastResolutionAdjustTime = Time.time;
                    }

                    CheckLowPowerMode();
                }
            }
        }

        private void AdjustResolutionDynamically()
        {
            float targetFPS = 60f;
            float tolerance = 10f;

            if (currentFPS < targetFPS - tolerance)
            {
                float newScale = currentResolutionScale * 0.9f;
                if (newScale >= minResolutionScale)
                {
                    ApplyResolutionScale(newScale);
                    Debug.Log($"[设备适配] 降分辨率: {currentFPS:F1} FPS -> 缩放 {newScale:F2}");
                }
            }
            else if (currentFPS > targetFPS + tolerance && currentResolutionScale < maxResolutionScale)
            {
                float newScale = Mathf.Min(maxResolutionScale, currentResolutionScale * 1.1f);
                ApplyResolutionScale(newScale);
                Debug.Log($"[设备适配] 升分辨率: {currentFPS:F1} FPS -> 缩放 {newScale:F2}");
            }
        }

        private void CheckLowPowerMode()
        {
            bool shouldBeLowPower = currentFPS < minFrameRateForTierDetection;

            if (shouldBeLowPower != isLowPowerMode)
            {
                isLowPowerMode = shouldBeLowPower;
                OnLowPowerModeChanged?.Invoke(isLowPowerMode);

                if (isLowPowerMode)
                {
                    ApplyLowPowerMode();
                }
                else
                {
                    RestoreFromLowPowerMode();
                }
            }
        }

        private void ApplyLowPowerMode()
        {
            Debug.LogWarning("[设备适配] 进入低性能模式");

            QualitySettings.pixelLightCount = Mathf.Max(0, QualitySettings.pixelLightCount - 1);
            QualitySettings.shadows = ShadowQuality.Disable;
            QualitySettings.antiAliasing = 0;
            QualitySettings.lodBias = Mathf.Max(0.5f, QualitySettings.lodBias * 0.7f);

            Application.targetFrameRate = 30;
            Time.fixedDeltaTime = 1f / 30f;

            foreach (ParticleSystem ps in trackedParticles)
            {
                if (ps != null)
                {
                    ParticleSystem.EmissionModule em = ps.emission;
                    em.rateOverTimeMultiplier *= 0.5f;
                }
            }
        }

        private void RestoreFromLowPowerMode()
        {
            Debug.Log("[设备适配] 退出低性能模式");

            ApplyQualityForTier(currentTier);
            Application.targetFrameRate = 60;
            Time.fixedDeltaTime = 1f / 60f;
        }

        public void ForceLowQuality()
        {
            currentTier = DeviceTier.LowEnd;
            ApplyQualityForTier(DeviceTier.LowEnd);
            OnTierChanged?.Invoke(DeviceTier.LowEnd);
        }

        public void ForceHighQuality()
        {
            currentTier = DeviceTier.HighEnd;
            ApplyQualityForTier(DeviceTier.HighEnd);
            OnTierChanged?.Invoke(DeviceTier.HighEnd);
        }

        public string GetSystemInfo()
        {
            return $@"
设备型号: {SystemInfo.deviceModel}
操作系统: {SystemInfo.operatingSystem}
处理器: {SystemInfo.processorType}
CPU核数: {SystemInfo.processorCount}
系统内存: {SystemInfo.systemMemorySize} MB
显卡: {SystemInfo.graphicsDeviceName}
显存: {SystemInfo.graphicsMemorySize} MB
屏幕分辨率: {Screen.currentResolution.width}x{Screen.currentResolution.height}
当前档位: {currentTier}
当前FPS: {currentFPS:F1}
分辨率缩放: {currentResolutionScale:F2}
低性能模式: {isLowPowerMode}
            ";
        }

        private void OnDestroy()
        {
            if (monitoringCoroutine != null)
            {
                StopCoroutine(monitoringCoroutine);
            }
        }
    }

    public enum DeviceTier
    {
        LowEnd,
        MidRange,
        HighEnd
    }

    [System.Serializable]
    public class QualityPreset
    {
        public int pixelLightCount;
        public ShadowQuality shadowQuality;
        public ShadowResolution shadowResolution;
        public int antiAliasing;
        public int vSyncCount;
        public float lodBias;
        public int particleRaycastBudget;
        public bool softParticles;
        public bool softVegetation;
        public bool realtimeReflectionProbes;
        public bool billboardsFaceCameraPosition;
        public float resolutionScalingFixedDPIFactor;
    }
}
