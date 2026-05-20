using UnityEngine;
using System;
using System.IO;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.Levels;
using MortiseTenonGame.MortiseTenon;

namespace MortiseTenonGame.SaveSystem
{
    [Serializable]
    public class PieceProgressData
    {
        public string PieceId;
        public float[] Position;
        public float[] Rotation;
        public bool IsPlaced;
        public bool IsConnected;
        public int ConnectionCount;
    }

    [Serializable]
    public class LevelProgressData
    {
        public int LevelId;
        public float CurrentProgress;
        public float ElapsedTime;
        public List<PieceProgressData> Pieces;
    }

    [Serializable]
    public class LevelSaveData
    {
        public int LevelId;
        public bool IsUnlocked;
        public bool IsCompleted;
        public int BestScore;
        public float BestTime;
        public int StarsEarned;
        public int Attempts;
        public long LastPlayedTimestamp;
    }

    [Serializable]
    public class GameSaveData
    {
        public List<LevelSaveData> Levels;
        public List<LevelProgressData> LevelProgresses;
        public int CurrentLevelIndex;
        public int LastPlayedLevelIndex;
        public int TotalScore;
        public int TotalStars;
        public bool SoundEnabled;
        public bool MusicEnabled;
        public float SoundVolume;
        public float MusicVolume;
        public string Language;
        public long LastSaveTimestamp;

        public GameSaveData()
        {
            Levels = new List<LevelSaveData>();
            LevelProgresses = new List<LevelProgressData>();
            SoundEnabled = true;
            MusicEnabled = true;
            SoundVolume = 1f;
            MusicVolume = 1f;
            Language = "zh-CN";
            CurrentLevelIndex = 0;
            LastPlayedLevelIndex = 0;
        }
    }

    public static class SaveManager
    {
        private static string _saveFilePath;
        private static string _progressFilePath;
        private static GameSaveData _currentSaveData;

        public static GameSaveData CurrentSaveData => _currentSaveData;
        public static event Action<GameSaveData> OnSaveLoaded;
        public static event Action<GameSaveData> OnSaveSaved;
        public static event Action<string> OnError;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            _saveFilePath = Path.Combine(Application.persistentDataPath, "gamesave.json");
            _progressFilePath = Path.Combine(Application.persistentDataPath, "levelprogress.json");
            LoadGame();
        }

        public static void SaveGame()
        {
            try
            {
                _currentSaveData.LastSaveTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                string json = JsonUtility.ToJson(_currentSaveData, true);
                File.WriteAllText(_saveFilePath, json);
                OnSaveSaved?.Invoke(_currentSaveData);
                Debug.Log($"Game saved successfully to: {_saveFilePath}");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save game: {e.Message}");
                OnError?.Invoke($"保存失败: {e.Message}");
            }
        }

        public static void LoadGame()
        {
            try
            {
                if (File.Exists(_saveFilePath))
                {
                    string json = File.ReadAllText(_saveFilePath);
                    _currentSaveData = JsonUtility.FromJson<GameSaveData>(json);
                    
                    if (_currentSaveData?.Levels == null || _currentSaveData.Levels.Count == 0)
                    {
                        Debug.LogWarning("Save file exists but is invalid, creating new save");
                        _currentSaveData = CreateNewSave();
                    }
                    
                    Debug.Log($"Game loaded successfully from: {_saveFilePath}");
                }
                else
                {
                    _currentSaveData = CreateNewSave();
                    SaveGame();
                    Debug.Log("New save file created");
                }

                OnSaveLoaded?.Invoke(_currentSaveData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load game: {e.Message}");
                _currentSaveData = CreateNewSave();
                OnError?.Invoke($"加载失败: {e.Message}");
            }
        }

        private static GameSaveData CreateNewSave()
        {
            var saveData = new GameSaveData();

            for (int i = 1; i <= 5; i++)
            {
                saveData.Levels.Add(new LevelSaveData
                {
                    LevelId = i,
                    IsUnlocked = i == 1,
                    IsCompleted = false,
                    BestScore = 0,
                    BestTime = 0,
                    StarsEarned = 0,
                    Attempts = 0,
                    LastPlayedTimestamp = 0
                });
            }

            return saveData;
        }

        public static bool SaveCurrentProgress()
        {
            try
            {
                var levelManager = LevelManager.Instance;
                if (levelManager == null || levelManager.CurrentLevel == null)
                {
                    Debug.LogWarning("No active level to save progress for");
                    return false;
                }

                var pieceManager = PieceManager.Instance;
                if (pieceManager == null)
                {
                    Debug.LogWarning("PieceManager not found");
                    return false;
                }

                var progressData = new LevelProgressData
                {
                    LevelId = levelManager.CurrentLevel.LevelId,
                    CurrentProgress = pieceManager.GetTotalConnectionProgress(),
                    ElapsedTime = UIManager.Instance.GetCurrentTime(),
                    Pieces = new List<PieceProgressData>()
                };

                var pieces = pieceManager.SpawnedPieces;
                foreach (var piece in pieces)
                {
                    if (piece != null)
                    {
                        var pieceData = new PieceProgressData
                        {
                            PieceId = piece.PieceId ?? piece.PieceType.ToString(),
                            Position = new float[] { piece.transform.position.x, piece.transform.position.y, piece.transform.position.z },
                            Rotation = new float[] { piece.transform.rotation.x, piece.transform.rotation.y, piece.transform.rotation.z, piece.transform.rotation.w },
                            IsPlaced = piece.IsPlaced,
                            IsConnected = piece.CurrentConnections > 0,
                            ConnectionCount = piece.CurrentConnections
                        };
                        progressData.Pieces.Add(pieceData);
                    }
                }

                var existingProgress = _currentSaveData.LevelProgresses.Find(p => p.LevelId == progressData.LevelId);
                if (existingProgress != null)
                {
                    _currentSaveData.LevelProgresses.Remove(existingProgress);
                }
                _currentSaveData.LevelProgresses.Add(progressData);

                _currentSaveData.LastPlayedLevelIndex = levelManager.CurrentLevelIndex;

                SaveGame();
                Debug.Log($"Progress saved for level: {progressData.LevelId}");
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save progress: {e.Message}");
                OnError?.Invoke($"进度保存失败: {e.Message}");
                return false;
            }
        }

        public static bool LoadSavedProgress()
        {
            try
            {
                var levelManager = LevelManager.Instance;
                if (levelManager == null)
                {
                    Debug.LogWarning("LevelManager not found");
                    return false;
                }

                int targetLevelId = levelManager.CurrentLevel?.LevelId ?? _currentSaveData.LastPlayedLevelIndex + 1;
                
                var progressData = _currentSaveData.LevelProgresses.Find(p => p.LevelId == targetLevelId);
                if (progressData == null)
                {
                    Debug.LogWarning($"No saved progress found for level: {targetLevelId}");
                    return false;
                }

                if (levelManager.CurrentLevel == null || levelManager.CurrentLevel.LevelId != targetLevelId)
                {
                    levelManager.StartLevel(targetLevelId - 1);
                }

                var pieceManager = PieceManager.Instance;
                if (pieceManager == null)
                {
                    Debug.LogWarning("PieceManager not found");
                    return false;
                }

                var pieces = pieceManager.SpawnedPieces;
                for (int i = 0; i < pieces.Count && i < progressData.Pieces.Count; i++)
                {
                    var piece = pieces[i];
                    var pieceData = progressData.Pieces[i];

                    if (piece != null)
                    {
                        piece.transform.position = new Vector3(pieceData.Position[0], pieceData.Position[1], pieceData.Position[2]);
                        piece.transform.rotation = new Quaternion(pieceData.Rotation[0], pieceData.Rotation[1], pieceData.Rotation[2], pieceData.Rotation[3]);
                    }
                }

                if (UIManager.Instance != null)
                {
                    UIManager.Instance.StartTimer();
                    UIManager.Instance.GetType().GetField("_gameTimer", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)?.SetValue(UIManager.Instance, progressData.ElapsedTime);
                }

                levelManager.CheckLevelCompletion();

                Debug.Log($"Progress loaded for level: {targetLevelId}");
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load progress: {e.Message}");
                OnError?.Invoke($"进度加载失败: {e.Message}");
                return false;
            }
        }

        public static bool HasSavedProgress(int levelId)
        {
            return _currentSaveData.LevelProgresses.Exists(p => p.LevelId == levelId);
        }

        public static LevelProgressData GetSavedProgress(int levelId)
        {
            return _currentSaveData.LevelProgresses.Find(p => p.LevelId == levelId);
        }

        public static void ClearLevelProgress(int levelId)
        {
            _currentSaveData.LevelProgresses.RemoveAll(p => p.LevelId == levelId);
            SaveGame();
        }

        public static void CompleteLevel(int levelId, int score, float time, int stars)
        {
            try
            {
                var levelData = _currentSaveData.Levels.Find(l => l.LevelId == levelId);
                if (levelData != null)
                {
                    levelData.IsCompleted = true;
                    levelData.IsUnlocked = true;
                    levelData.Attempts++;
                    levelData.LastPlayedTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

                    if (score > levelData.BestScore)
                    {
                        levelData.BestScore = score;
                    }

                    if (levelData.BestTime == 0 || time < levelData.BestTime)
                    {
                        levelData.BestTime = time;
                    }

                    if (stars > levelData.StarsEarned)
                    {
                        levelData.StarsEarned = stars;
                    }

                    int nextLevelId = levelId + 1;
                    var nextLevel = _currentSaveData.Levels.Find(l => l.LevelId == nextLevelId);
                    if (nextLevel != null)
                    {
                        nextLevel.IsUnlocked = true;
                    }

                    _currentSaveData.TotalScore += score;
                    _currentSaveData.TotalStars += stars;

                    ClearLevelProgress(levelId);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Error completing level: {e.Message}");
            }
        }

        public static LevelSaveData GetLevelSaveData(int levelId)
        {
            return _currentSaveData.Levels.Find(l => l.LevelId == levelId);
        }

        public static bool IsLevelUnlocked(int levelId)
        {
            var levelData = GetLevelSaveData(levelId);
            return levelData != null && levelData.IsUnlocked;
        }

        public static void UpdateSettings(bool soundEnabled, bool musicEnabled, float soundVolume, float musicVolume, string language)
        {
            _currentSaveData.SoundEnabled = soundEnabled;
            _currentSaveData.MusicEnabled = musicEnabled;
            _currentSaveData.SoundVolume = soundVolume;
            _currentSaveData.MusicVolume = musicVolume;
            _currentSaveData.Language = language;

            SaveGame();
        }

        public static void ResetSave()
        {
            _currentSaveData = CreateNewSave();
            SaveGame();
            Debug.Log("Save data reset");
        }

        public static void DeleteSave()
        {
            if (File.Exists(_saveFilePath))
            {
                File.Delete(_saveFilePath);
            }
            if (File.Exists(_progressFilePath))
            {
                File.Delete(_progressFilePath);
            }
            _currentSaveData = CreateNewSave();
            Debug.Log("Save files deleted");
        }

        public static bool HasSaveFile()
        {
            return File.Exists(_saveFilePath);
        }

        public static int GetCompletedLevelCount()
        {
            return _currentSaveData.Levels.FindAll(l => l.IsCompleted).Count;
        }

        public static int GetTotalStarsEarned()
        {
            int total = 0;
            foreach (var level in _currentSaveData.Levels)
            {
                total += level.StarsEarned;
            }
            return total;
        }

        public static string GetFormattedSaveTime()
        {
            if (_currentSaveData.LastSaveTimestamp == 0)
            {
                return "从未保存";
            }
            DateTime saveTime = DateTimeOffset.FromUnixTimeSeconds(_currentSaveData.LastSaveTimestamp).LocalDateTime;
            return saveTime.ToString("yyyy-MM-dd HH:mm:ss");
        }
    }
}