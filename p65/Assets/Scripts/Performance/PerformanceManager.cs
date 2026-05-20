using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace TieDyeGame.Performance
{
    public enum PerformanceLevel
    {
        Low,
        Medium,
        High,
        Ultra
    }

    [Serializable]
    public class PerformanceSettings
    {
        public PerformanceLevel level;
        public int targetFrameRate;
        public int simulationGridSize;
        public bool useTextureCompression;
        public bool useLowQualityShaders;
        public bool disableParticleEffects;
        public bool disableBackgroundAnimations;
        public float simulationUpdateInterval;
        public bool enableVSync;
    }

    public class PerformanceManager : MonoBehaviour
    {
        public static PerformanceManager Instance { get; private set; }

        [Header("Settings Profiles")]
        public PerformanceSettings[] settingsProfiles;

        [Header("Current State")]
        public PerformanceLevel currentLevel = PerformanceLevel.Medium;
        public float averageFps;
        public float frameTime;
        public bool isThermalThrottling;

        [Header("FPS Monitor")]
        [SerializeField] private bool showFpsCounter;
        [SerializeField] private Text fpsCounterText;
        [SerializeField] private float fpsUpdateInterval = 0.5f;

        [Header("Auto Adjustment")]
        [SerializeField] private bool autoAdjustPerformance = true;
        [SerializeField] private float lowFpsThreshold = 25f;
        [SerializeField] private float highFpsThreshold = 55f;
        [SerializeField] private int consecutiveLowFpsFrames = 10;
        [SerializeField] private int consecutiveHighFpsFrames = 30;

        private int _lowFpsCounter;
        private int _highFpsCounter;
        private float _fpsTimer;
        private int _frameCount;
        private Coroutine _autoAdjustCoroutine;

        public event Action<PerformanceLevel> OnPerformanceLevelChanged;
        public event Action<float> OnFpsUpdated;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeProfiles();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeProfiles()
        {
            if (settingsProfiles == null || settingsProfiles.Length == 0)
            {
                settingsProfiles = new[]
                {
                    new PerformanceSettings
                    {
                        level = PerformanceLevel.Low,
                        targetFrameRate = 30,
                        simulationGridSize = 64,
                        useTextureCompression = true,
                        useLowQualityShaders = true,
                        disableParticleEffects = true,
                        disableBackgroundAnimations = true,
                        simulationUpdateInterval = 0.05f,
                        enableVSync = false
                    },
                    new PerformanceSettings
                    {
                        level = PerformanceLevel.Medium,
                        targetFrameRate = 60,
                        simulationGridSize = 96,
                        useTextureCompression = true,
                        useLowQualityShaders = false,
                        disableParticleEffects = false,
                        disableBackgroundAnimations = false,
                        simulationUpdateInterval = 0.02f,
                        enableVSync = true
                    },
                    new PerformanceSettings
                    {
                        level = PerformanceLevel.High,
                        targetFrameRate = 60,
                        simulationGridSize = 128,
                        useTextureCompression = false,
                        useLowQualityShaders = false,
                        disableParticleEffects = false,
                        disableBackgroundAnimations = false,
                        simulationUpdateInterval = 0.016f,
                        enableVSync = true
                    },
                    new PerformanceSettings
                    {
                        level = PerformanceLevel.Ultra,
                        targetFrameRate = 120,
                        simulationGridSize = 256,
                        useTextureCompression = false,
                        useLowQualityShaders = false,
                        disableParticleEffects = false,
                        disableBackgroundAnimations = false,
                        simulationUpdateInterval = 0.008f,
                        enableVSync = false
                    }
                };
            }
        }

        private void Start()
        {
            ApplyPerformanceSettings(currentLevel);
            
            if (autoAdjustPerformance)
            {
                _autoAdjustCoroutine = StartCoroutine(AutoAdjustPerformance());
            }

            if (fpsCounterText != null)
            {
                fpsCounterText.gameObject.SetActive(showFpsCounter);
            }
        }

        private void Update()
        {
            MonitorFps();
        }

        private void MonitorFps()
        {
            _frameCount++;
            _fpsTimer += Time.unscaledDeltaTime;

            if (_fpsTimer >= fpsUpdateInterval)
            {
                averageFps = _frameCount / _fpsTimer;
                frameTime = 1000f / averageFps;
                
                _frameCount = 0;
                _fpsTimer = 0f;

                OnFpsUpdated?.Invoke(averageFps);

                if (showFpsCounter && fpsCounterText != null)
                {
                    fpsCounterText.text = $"FPS: {averageFps:F1}\n{frameTime:F2}ms";
                    
                    fpsCounterText.color = averageFps switch
                    {
                        < 20f => Color.red,
                        < 30f => Color.yellow,
                        _ => Color.green
                    };
                }
            }
        }

        private IEnumerator AutoAdjustPerformance()
        {
            while (autoAdjustPerformance)
            {
                yield return new WaitForSeconds(2f);

                if (averageFps < lowFpsThreshold)
                {
                    _lowFpsCounter++;
                    _highFpsCounter = 0;

                    if (_lowFpsCounter >= consecutiveLowFpsFrames && currentLevel > PerformanceLevel.Low)
                    {
                        DecreasePerformanceLevel();
                        _lowFpsCounter = 0;
                    }
                }
                else if (averageFps > highFpsThreshold)
                {
                    _highFpsCounter++;
                    _lowFpsCounter = 0;

                    if (_highFpsCounter >= consecutiveHighFpsFrames && currentLevel < PerformanceLevel.Ultra)
                    {
                        IncreasePerformanceLevel();
                        _highFpsCounter = 0;
                    }
                }
                else
                {
                    _lowFpsCounter = 0;
                    _highFpsCounter = 0;
                }
            }
        }

        public void ApplyPerformanceSettings(PerformanceLevel level)
        {
            var settings = GetSettingsForLevel(level);
            if (settings == null) return;

            currentLevel = level;

            Application.targetFrameRate = settings.targetFrameRate;
            QualitySettings.vSyncCount = settings.enableVSync ? 1 : 0;

            AdjustShaderQuality(settings.useLowQualityShaders);
            AdjustTextureQuality(settings.useTextureCompression);

            OnPerformanceLevelChanged?.Invoke(level);
            Debug.Log($"Applied performance settings: {level}, Target FPS: {settings.targetFrameRate}");
        }

        private PerformanceSettings GetSettingsForLevel(PerformanceLevel level)
        {
            foreach (var settings in settingsProfiles)
            {
                if (settings.level == level)
                {
                    return settings;
                }
            }
            return null;
        }

        public PerformanceSettings GetCurrentSettings()
        {
            return GetSettingsForLevel(currentLevel);
        }

        public void IncreasePerformanceLevel()
        {
            if (currentLevel < PerformanceLevel.Ultra)
            {
                currentLevel++;
                ApplyPerformanceSettings(currentLevel);
            }
        }

        public void DecreasePerformanceLevel()
        {
            if (currentLevel > PerformanceLevel.Low)
            {
                currentLevel--;
                ApplyPerformanceSettings(currentLevel);
            }
        }

        public void SetPerformanceLevel(PerformanceLevel level)
        {
            if (currentLevel != level)
            {
                ApplyPerformanceSettings(level);
            }
        }

        private void AdjustShaderQuality(bool useLowQuality)
        {
            if (useLowQuality)
            {
                Shader.globalMaximumLOD = 300;
            }
            else
            {
                Shader.globalMaximumLOD = 600;
            }
        }

        private void AdjustTextureQuality(bool useCompression)
        {
            QualitySettings.masterTextureLimit = useCompression ? 1 : 0;
        }

        public int GetRecommendedGridSize()
        {
            var settings = GetCurrentSettings();
            return settings?.simulationGridSize ?? 96;
        }

        public float GetSimulationUpdateInterval()
        {
            var settings = GetCurrentSettings();
            return settings?.simulationUpdateInterval ?? 0.02f;
        }

        public bool ShouldDisableParticles()
        {
            var settings = GetCurrentSettings();
            return settings?.disableParticleEffects ?? false;
        }

        public bool ShouldDisableBackgroundAnimations()
        {
            var settings = GetCurrentSettings();
            return settings?.disableBackgroundAnimations ?? false;
        }

        public void ToggleFpsCounter(bool show)
        {
            showFpsCounter = show;
            if (fpsCounterText != null)
            {
                fpsCounterText.gameObject.SetActive(show);
            }
        }

        public void SetAutoAdjust(bool enable)
        {
            autoAdjustPerformance = enable;
            
            if (enable && _autoAdjustCoroutine == null)
            {
                _autoAdjustCoroutine = StartCoroutine(AutoAdjustPerformance());
            }
            else if (!enable && _autoAdjustCoroutine != null)
            {
                StopCoroutine(_autoAdjustCoroutine);
                _autoAdjustCoroutine = null;
            }
        }

        public string GetPerformanceLevelName(PerformanceLevel level)
        {
            return level switch
            {
                PerformanceLevel.Low => "低",
                PerformanceLevel.Medium => "中",
                PerformanceLevel.High => "高",
                PerformanceLevel.Ultra => "极高",
                _ => ""
            };
        }

        public void GarbageCollect()
        {
            System.GC.Collect();
            System.GC.WaitForPendingFinalizers();
            System.GC.Collect();
            Resources.UnloadUnusedAssets();
        }

        private void OnDestroy()
        {
            if (_autoAdjustCoroutine != null)
            {
                StopCoroutine(_autoAdjustCoroutine);
            }
        }
    }
}