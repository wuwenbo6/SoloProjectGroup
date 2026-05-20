using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Levels
{
    public class LevelManager : Singleton<LevelManager>
    {
        [Header("关卡列表")]
        public List<LevelData> allLevels = new List<LevelData>();

        [Header("玩家进度")]
        public int currentLevelIndex;
        public int totalStars;
        public Dictionary<int, int> levelStars = new Dictionary<int, int>();
        public Dictionary<int, int> levelBestScores = new Dictionary<int, int>();

        [Header("当前关卡状态")]
        public LevelData currentLevel;
        public float currentTime;
        public int currentScore;
        public bool isLevelComplete;
        public bool isLevelFailed;
        public bool isLoading { get; private set; }

        [Header("关卡目标进度")]
        public List<ObjectiveProgress> objectiveProgresses = new List<ObjectiveProgress>();

        public System.Action<LevelData> OnLevelStarted;
        public System.Action<LevelData, int, int> OnLevelCompleted;
        public System.Action OnLevelFailed;
        public System.Action<float> OnLoadProgress;
        public System.Action OnLoadComplete;

        private void Start()
        {
            LoadProgress();
        }

        private void LoadProgress()
        {
            string json = PlayerPrefs.GetString("LevelProgress", "");
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    LevelProgressData data = JsonUtility.FromJson<LevelProgressData>(json);
                    totalStars = data.totalStars;
                    levelStars = new Dictionary<int, int>();
                    levelBestScores = new Dictionary<int, int>();

                    foreach (var levelData in data.levelProgress)
                    {
                        levelStars[levelData.levelId] = levelData.stars;
                        levelBestScores[levelData.levelId] = levelData.bestScore;
                    }
                }
                catch
                {
                    InitializeProgress();
                }
            }
            else
            {
                InitializeProgress();
            }
        }

        private void InitializeProgress()
        {
            totalStars = 0;
            levelStars.Clear();
            levelBestScores.Clear();

            foreach (var level in allLevels)
            {
                levelStars[level.levelId] = 0;
                levelBestScores[level.levelId] = 0;
            }

            SaveProgress();
        }

        public void SaveProgress()
        {
            LevelProgressData data = new LevelProgressData();
            data.totalStars = totalStars;
            data.levelProgress = new List<LevelProgressItem>();

            foreach (var kvp in levelStars)
            {
                LevelProgressItem item = new LevelProgressItem();
                item.levelId = kvp.Key;
                item.stars = kvp.Value;
                item.bestScore = levelBestScores.ContainsKey(kvp.Key) ? levelBestScores[kvp.Key] : 0;
                data.levelProgress.Add(item);
            }

            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString("LevelProgress", json);
        }

        public void StartLevel(int levelIndex)
        {
            if (isLoading || levelIndex < 0 || levelIndex >= allLevels.Count)
                return;

            StartCoroutine(LoadLevelCoroutine(levelIndex));
        }

        private IEnumerator LoadLevelCoroutine(int levelIndex)
        {
            isLoading = true;
            Time.timeScale = 1f;

            CleanupBeforeLoad();
            OnLoadProgress?.Invoke(0.1f);

            yield return null;

            AsyncOperation loadOperation = SceneManager.LoadSceneAsync("GameScene");
            loadOperation.allowSceneActivation = false;

            while (!loadOperation.isDone)
            {
                float progress = Mathf.Clamp01(loadOperation.progress / 0.9f);
                OnLoadProgress?.Invoke(0.1f + progress * 0.8f);

                if (loadOperation.progress >= 0.9f)
                {
                    loadOperation.allowSceneActivation = true;
                }

                yield return null;
            }

            currentLevelIndex = levelIndex;
            currentLevel = allLevels[levelIndex];
            currentTime = currentLevel.timeLimit;
            currentScore = 0;
            isLevelComplete = false;
            isLevelFailed = false;

            InitializeObjectives();
            GameManager.Instance.ChangeState(GameState.LevelPlaying);
            OnLoadProgress?.Invoke(1f);
            OnLoadComplete?.Invoke();
            OnLevelStarted?.Invoke(currentLevel);

            yield return new WaitForSeconds(0.1f);
            isLoading = false;
        }

        private void CleanupBeforeLoad()
        {
            Resources.UnloadUnusedAssets();
            System.GC.Collect();
        }

        private void InitializeObjectives()
        {
            objectiveProgresses.Clear();

            foreach (var objective in currentLevel.objectives)
            {
                ObjectiveProgress progress = new ObjectiveProgress();
                progress.objective = objective;
                progress.currentValue = 0;
                progress.isCompleted = false;
                objectiveProgresses.Add(progress);
            }
        }

        public void UpdateObjectiveProgress(ObjectiveType type, int value)
        {
            foreach (var progress in objectiveProgresses)
            {
                if (progress.objective.type == type && !progress.isCompleted)
                {
                    progress.currentValue = value;
                    if (progress.currentValue >= progress.objective.targetValue)
                    {
                        progress.isCompleted = true;
                        currentScore += progress.objective.rewardStars * 10;
                    }
                }
            }

            CheckLevelCompletion();
        }

        public void AddScore(int points)
        {
            currentScore += points;
        }

        private void CheckLevelCompletion()
        {
            bool allObjectivesComplete = objectiveProgresses.TrueForAll(p => p.isCompleted);

            if (allObjectivesComplete && !isLevelComplete)
            {
                CompleteLevel();
            }
        }

        public void CompleteLevel()
        {
            if (isLevelComplete) return;

            isLevelComplete = true;
            Time.timeScale = 0f;

            int starsEarned = currentLevel.CalculateStars(currentScore);
            int previousStars = GetLevelStars(currentLevel.levelId);

            if (starsEarned > previousStars)
            {
                totalStars += (starsEarned - previousStars);
                levelStars[currentLevel.levelId] = starsEarned;
            }

            int previousBest = GetBestScore(currentLevel.levelId);
            if (currentScore > previousBest)
            {
                levelBestScores[currentLevel.levelId] = currentScore;
            }

            SaveProgress();
            OnLevelCompleted?.Invoke(currentLevel, currentScore, starsEarned);
        }

        public void FailLevel()
        {
            if (isLevelFailed) return;

            isLevelFailed = true;
            Time.timeScale = 0f;
            OnLevelFailed?.Invoke();
        }

        public void RestartLevel()
        {
            Time.timeScale = 1f;
            StartLevel(currentLevelIndex);
        }

        public void ReturnToMainMenu()
        {
            if (isLoading) return;

            StartCoroutine(LoadMainMenuCoroutine());
        }

        private IEnumerator LoadMainMenuCoroutine()
        {
            isLoading = true;
            Time.timeScale = 1f;

            CleanupBeforeLoad();
            OnLoadProgress?.Invoke(0.1f);

            yield return null;

            AsyncOperation loadOperation = SceneManager.LoadSceneAsync("MainMenu");
            loadOperation.allowSceneActivation = false;

            while (!loadOperation.isDone)
            {
                float progress = Mathf.Clamp01(loadOperation.progress / 0.9f);
                OnLoadProgress?.Invoke(0.1f + progress * 0.8f);

                if (loadOperation.progress >= 0.9f)
                {
                    loadOperation.allowSceneActivation = true;
                }

                yield return null;
            }

            GameManager.Instance.ChangeState(GameState.MainMenu);
            OnLoadProgress?.Invoke(1f);
            OnLoadComplete?.Invoke();

            yield return new WaitForSeconds(0.1f);
            isLoading = false;
        }

        public List<LevelData> GetUnlockedLevels()
        {
            return allLevels.FindAll(l => l.IsUnlocked(totalStars));
        }

        public int GetLevelStars(int levelId)
        {
            return levelStars.ContainsKey(levelId) ? levelStars[levelId] : 0;
        }

        public int GetBestScore(int levelId)
        {
            return levelBestScores.ContainsKey(levelId) ? levelBestScores[levelId] : 0;
        }

        private void Update()
        {
            if (GameManager.Instance.currentState == GameState.LevelPlaying && !isLevelComplete && !isLevelFailed)
            {
                currentTime -= Time.deltaTime;

                if (currentTime <= 0)
                {
                    currentTime = 0;
                    FailLevel();
                }
            }
        }
    }

    [System.Serializable]
    public class ObjectiveProgress
    {
        public LevelObjective objective;
        public int currentValue;
        public bool isCompleted;
    }

    [System.Serializable]
    public class LevelProgressData
    {
        public int totalStars;
        public List<LevelProgressItem> levelProgress;
    }

    [System.Serializable]
    public class LevelProgressItem
    {
        public int levelId;
        public int stars;
        public int bestScore;
    }
}
