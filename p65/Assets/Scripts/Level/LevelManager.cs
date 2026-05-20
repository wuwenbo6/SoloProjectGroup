using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TieDyeGame.Level
{
    public class LevelManager : MonoBehaviour
    {
        public static LevelManager Instance { get; private set; }

        [Header("Level Setup")]
        public LevelData[] allLevels;
        public LevelData currentLevel;
        public string gameSceneName = "GameScene";
        public string menuSceneName = "MainMenu";
        
        [Header("Game State")]
        public bool isLevelActive;
        public float currentTime;
        public int dyeApplicationsUsed;
        public int colorsUsed;
        public bool isPaused;
        public bool isLoading { get; private set; }
        
        public event Action OnLevelStarted;
        public event Action OnLevelCompleted;
        public event Action OnLevelFailed;
        public event Action OnTimeUpdated;
        public event Action<float> OnLoadProgress;
        public event Action OnLoadComplete;

        private Dictionary<int, Texture2D> _targetTextureCache = new Dictionary<int, Texture2D>();
        private Coroutine _currentLoadCoroutine;
        private bool _isInitialized;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeManager();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeManager()
        {
            if (_isInitialized) return;
            
            StartCoroutine(PreloadCommonResources());
            _isInitialized = true;
        }

        private IEnumerator PreloadCommonResources()
        {
            yield return null;
            
            foreach (var level in allLevels)
            {
                if (level != null && level.targetPattern != null)
                {
                    if (!_targetTextureCache.ContainsKey(level.levelId))
                    {
                        _targetTextureCache[level.levelId] = level.targetPattern;
                    }
                }
            }
        }

        public void LoadLevelAsync(int levelId, Action onComplete = null)
        {
            if (isLoading)
            {
                Debug.LogWarning("Already loading a level!");
                return;
            }

            if (_currentLoadCoroutine != null)
            {
                StopCoroutine(_currentLoadCoroutine);
            }

            _currentLoadCoroutine = StartCoroutine(LoadLevelCoroutine(levelId, onComplete));
        }

        private IEnumerator LoadLevelCoroutine(int levelId, Action onComplete)
        {
            isLoading = true;
            OnLoadProgress?.Invoke(0f);

            var level = Array.Find(allLevels, l => l.levelId == levelId);
            if (level == null)
            {
                Debug.LogError($"Level {levelId} not found!");
                isLoading = false;
                yield break;
            }

            yield return Resources.UnloadUnusedAssets();
            GC.Collect();
            GC.WaitForPendingFinalizers();
            yield return null;

            OnLoadProgress?.Invoke(0.2f);

            var asyncLoad = SceneManager.LoadSceneAsync(gameSceneName, LoadSceneMode.Single);
            asyncLoad.allowSceneActivation = false;

            while (!asyncLoad.isDone)
            {
                var progress = Mathf.Clamp01(asyncLoad.progress / 0.9f);
                OnLoadProgress?.Invoke(0.2f + progress * 0.6f);
                
                if (asyncLoad.progress >= 0.9f)
                {
                    break;
                }
                
                yield return null;
            }

            OnLoadProgress?.Invoke(0.8f);

            asyncLoad.allowSceneActivation = true;
            yield return new WaitUntil(() => SceneManager.GetSceneByName(gameSceneName).isLoaded);
            
            yield return null;

            PrepareLevel(levelId);
            
            OnLoadProgress?.Invoke(1f);
            OnLoadComplete?.Invoke();
            onComplete?.Invoke();
            
            isLoading = false;
            _currentLoadCoroutine = null;
        }

        public void ReturnToMenuAsync(Action onComplete = null)
        {
            if (isLoading) return;
            
            StopAllCoroutines();
            StartCoroutine(ReturnToMenuCoroutine(onComplete));
        }

        private IEnumerator ReturnToMenuCoroutine(Action onComplete)
        {
            isLoading = true;
            
            isLevelActive = false;
            currentLevel = null;
            
            yield return Resources.UnloadUnusedAssets();
            GC.Collect();
            yield return null;

            var asyncLoad = SceneManager.LoadSceneAsync(menuSceneName, LoadSceneMode.Single);
            
            while (!asyncLoad.isDone)
            {
                yield return null;
            }

            yield return null;
            onComplete?.Invoke();
            isLoading = false;
        }

        private void PrepareLevel(int levelId)
        {
            currentLevel = Array.Find(allLevels, l => l.levelId == levelId);
            if (currentLevel == null)
            {
                Debug.LogError($"Level {levelId} not found!");
                return;
            }

            currentTime = currentLevel.timeLimit;
            dyeApplicationsUsed = 0;
            colorsUsed = 0;
            isLevelActive = true;
            isPaused = false;
            
            OnLevelStarted?.Invoke();
        }

        public void StartLevel(int levelId)
        {
            if (isLoading)
            {
                Debug.LogWarning("Cannot start level while loading!");
                return;
            }

            PrepareLevel(levelId);
        }

        private void Update()
        {
            if (!isLevelActive || isPaused) return;
            
            currentTime -= Time.deltaTime;
            OnTimeUpdated?.Invoke();
            
            if (currentTime <= 0)
            {
                FailLevel("Time's up!");
            }
        }

        public void IncrementDyeApplications()
        {
            dyeApplicationsUsed++;
            if (dyeApplicationsUsed >= currentLevel?.maxDyeApplications)
            {
                Debug.Log("Max dye applications reached!");
            }
        }

        public bool CanApplyDye()
        {
            return isLevelActive && currentLevel != null &&
                   dyeApplicationsUsed < currentLevel.maxDyeApplications;
        }

        public bool CanUseColor(Color color)
        {
            if (currentLevel?.availableColors == null) return false;
            return Array.Exists(currentLevel.availableColors, c => c == color);
        }

        public void CompleteLevel(float similarity)
        {
            if (!isLevelActive || currentLevel == null) return;
            
            isLevelActive = false;
            
            var finalScore = CalculateFinalScore(similarity);
            var stars = CalculateStars(similarity);
            
            try
            {
                if (Save.LevelSaveData.Instance != null)
                {
                    Save.LevelSaveData.Instance.SaveLevelProgress(
                        currentLevel.levelId, 
                        true, 
                        finalScore, 
                        stars,
                        similarity
                    );
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save level progress: {e.Message}");
            }
            
            OnLevelCompleted?.Invoke();
        }

        public void FailLevel(string reason)
        {
            if (!isLevelActive) return;
            
            isLevelActive = false;
            OnLevelFailed?.Invoke();
            Debug.Log($"Level failed: {reason}");
        }

        private int CalculateFinalScore(float similarity)
        {
            if (currentLevel == null) return 0;
            
            var timeBonus = Mathf.Max(0, currentTime / currentLevel.timeLimit) * 500;
            var similarityScore = similarity * 1000;
            var efficiencyBonus = Mathf.Max(0, 1 - (float)dyeApplicationsUsed / Mathf.Max(1, currentLevel.maxDyeApplications)) * 300;
            
            return Mathf.FloorToInt(timeBonus + similarityScore + efficiencyBonus);
        }

        private int CalculateStars(float similarity)
        {
            if (currentLevel == null) return 0;
            
            if (similarity >= 0.9f) return 3;
            if (similarity >= 0.8f) return 2;
            if (similarity >= currentLevel.requiredSimilarity) return 1;
            return 0;
        }

        public float CalculateSimilarity(Color[,] playerResult, Texture2D target)
        {
            if (playerResult == null || target == null)
            {
                Debug.LogWarning("Invalid input for similarity calculation!");
                return 0f;
            }

            var width = Math.Min(target.width, playerResult.GetLength(0));
            var height = Math.Min(target.height, playerResult.GetLength(1));
            var totalSimilarity = 0f;
            var pixelCount = 0;

            try
            {
                for (var x = 0; x < width; x++)
                {
                    for (var y = 0; y < height; y++)
                    {
                        var targetPixel = target.GetPixel(x, y);
                        var playerPixel = playerResult[x, y];
                        
                        var colorDistance = Vector4.Distance(
                            new Vector4(targetPixel.r, targetPixel.g, targetPixel.b, targetPixel.a),
                            new Vector4(playerPixel.r, playerPixel.g, playerPixel.b, playerPixel.a)
                        );
                        
                        totalSimilarity += 1f - (colorDistance / 2f);
                        pixelCount++;
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Error during similarity calculation: {e.Message}");
                return 0.5f;
            }

            return pixelCount > 0 ? totalSimilarity / pixelCount : 0f;
        }

        public void PauseLevel()
        {
            isPaused = true;
        }

        public void ResumeLevel()
        {
            isPaused = false;
        }

        public void RestartLevel()
        {
            if (currentLevel != null && !isLoading)
            {
                LoadLevelAsync(currentLevel.levelId);
            }
        }

        public bool IsLevelUnlocked(int levelId)
        {
            var level = Array.Find(allLevels, l => l.levelId == levelId);
            if (level == null) return false;

            try
            {
                if (Save.LevelSaveData.Instance == null)
                {
                    return level.requiredCompletedLevels <= 0 && level.requiredScore <= 0;
                }
                
                var completedCount = Save.LevelSaveData.Instance.GetCompletedLevelsCount();
                var totalScore = Save.LevelSaveData.Instance.GetTotalScore();
                
                return completedCount >= level.requiredCompletedLevels && 
                       totalScore >= level.requiredScore;
            }
            catch (Exception e)
            {
                Debug.LogError($"Error checking level unlock status: {e.Message}");
                return true;
            }
        }

        public List<LevelData> GetUnlockedLevels()
        {
            var unlockedLevels = new List<LevelData>();
            foreach (var level in allLevels)
            {
                if (IsLevelUnlocked(level.levelId))
                {
                    unlockedLevels.Add(level);
                }
            }
            return unlockedLevels;
        }

        public Texture2D GetCachedTargetTexture(int levelId)
        {
            return _targetTextureCache.TryGetValue(levelId, out var texture) ? texture : null;
        }

        public void ClearCache()
        {
            foreach (var texture in _targetTextureCache.Values)
            {
                if (texture != null)
                {
                    Destroy(texture);
                }
            }
            _targetTextureCache.Clear();
            
            StartCoroutine(Resources.UnloadUnusedAssets());
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                ClearCache();
                Instance = null;
            }
        }
    }
}