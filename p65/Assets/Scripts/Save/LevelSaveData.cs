using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace TieDyeGame.Save
{
    [Serializable]
    public class LevelProgress
    {
        public int levelId;
        public bool isCompleted;
        public int bestScore;
        public int stars;
        public float bestSimilarity;
    }

    [Serializable]
    public class GameSaveData
    {
        public int saveVersion = 1;
        public long timestamp;
        public List<LevelProgress> levelProgresses = new List<LevelProgress>();
        public int totalCoins;
        public int totalExp;
        public int playerLevel;
        public List<int> unlockedFabrics = new List<int>();
        public List<int> unlockedPatterns = new List<int>();
    }

    public class LevelSaveData : MonoBehaviour
    {
        public static LevelSaveData Instance { get; private set; }

        private GameSaveData _saveData;
        private const string SaveKey = "TieDyeGameSave";
        private const string BackupKey = "TieDyeGameSave_Backup";
        private const string ChecksumKey = "TieDyeGameSave_Checksum";
        private const string HashSalt = "TieDye2024_Salt";
        
        private bool _isSaving;
        private bool _isLoaded;

        public event Action OnSaveLoaded;
        public event Action<string> OnSaveError;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                StartCoroutine(LoadSaveDataAsync());
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private System.Collections.IEnumerator LoadSaveDataAsync()
        {
            yield return null;
            
            try
            {
                if (TryLoadFromPlayerPrefs(out _saveData))
                {
                    _isLoaded = true;
                    OnSaveLoaded?.Invoke();
                    Debug.Log("Save data loaded successfully!");
                    yield break;
                }

                Debug.LogWarning("Primary save corrupted, trying backup...");
                if (TryLoadBackup(out _saveData))
                {
                    _isLoaded = true;
                    SaveToDisk();
                    OnSaveLoaded?.Invoke();
                    Debug.Log("Backup restored successfully!");
                    yield break;
                }

                Debug.Log("Creating new save data...");
                _saveData = new GameSaveData
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                };
                _isLoaded = true;
                SaveToDisk();
                OnSaveLoaded?.Invoke();
            }
            catch (Exception e)
            {
                Debug.LogError($"Fatal error loading save: {e.Message}");
                _saveData = new GameSaveData();
                _isLoaded = true;
                OnSaveError?.Invoke(e.Message);
            }
        }

        private bool TryLoadFromPlayerPrefs(out GameSaveData data)
        {
            data = null;
            
            if (!PlayerPrefs.HasKey(SaveKey))
            {
                return false;
            }

            try
            {
                var json = PlayerPrefs.GetString(SaveKey);
                
                if (PlayerPrefs.HasKey(ChecksumKey))
                {
                    var storedChecksum = PlayerPrefs.GetString(ChecksumKey);
                    var actualChecksum = CalculateChecksum(json);
                    
                    if (storedChecksum != actualChecksum)
                    {
                        Debug.LogError("Save data checksum mismatch!");
                        return false;
                    }
                }

                data = JsonUtility.FromJson<GameSaveData>(json);
                
                if (data == null)
                {
                    return false;
                }

                SanitizeSaveData(data);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load save: {e.Message}");
                return false;
            }
        }

        private bool TryLoadBackup(out GameSaveData data)
        {
            data = null;
            
            if (!PlayerPrefs.HasKey(BackupKey))
            {
                return false;
            }

            try
            {
                var json = PlayerPrefs.GetString(BackupKey);
                data = JsonUtility.FromJson<GameSaveData>(json);
                
                if (data == null)
                {
                    return false;
                }

                SanitizeSaveData(data);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private void SanitizeSaveData(GameSaveData data)
        {
            data.levelProgresses ??= new List<LevelProgress>();
            data.unlockedFabrics ??= new List<int>();
            data.unlockedPatterns ??= new List<int>();
            
            data.totalCoins = Math.Max(0, data.totalCoins);
            data.totalExp = Math.Max(0, data.totalExp);
            data.playerLevel = Math.Max(1, data.playerLevel);

            foreach (var progress in data.levelProgresses)
            {
                progress.bestScore = Math.Max(0, progress.bestScore);
                progress.stars = Math.Clamp(progress.stars, 0, 3);
                progress.bestSimilarity = Math.Clamp(progress.bestSimilarity, 0f, 1f);
            }
        }

        public void SaveLevelProgress(int levelId, bool isCompleted, int score, int stars, float similarity)
        {
            EnsureSaveDataReady();
            
            var progress = _saveData.levelProgresses.Find(p => p.levelId == levelId);
            if (progress == null)
            {
                progress = new LevelProgress { levelId = levelId };
                _saveData.levelProgresses.Add(progress);
            }

            progress.isCompleted = progress.isCompleted || isCompleted;
            progress.bestScore = Math.Max(progress.bestScore, score);
            progress.stars = Math.Max(progress.stars, stars);
            progress.bestSimilarity = Math.Max(progress.bestSimilarity, similarity);

            SaveToDisk();
        }

        public LevelProgress GetLevelProgress(int levelId)
        {
            EnsureSaveDataReady();
            return _saveData.levelProgresses.Find(p => p.levelId == levelId);
        }

        public int GetCompletedLevelsCount()
        {
            EnsureSaveDataReady();
            return _saveData.levelProgresses.FindAll(p => p.isCompleted).Count;
        }

        public int GetTotalScore()
        {
            EnsureSaveDataReady();
            var total = 0;
            foreach (var progress in _saveData.levelProgresses)
            {
                total += progress.bestScore;
            }
            return total;
        }

        public void AddCoins(int amount)
        {
            EnsureSaveDataReady();
            _saveData.totalCoins = Math.Max(0, _saveData.totalCoins + amount);
            SaveToDisk();
        }

        public int GetCoins()
        {
            EnsureSaveDataReady();
            return _saveData.totalCoins;
        }

        public void AddExp(int amount)
        {
            EnsureSaveDataReady();
            _saveData.totalExp = Math.Max(0, _saveData.totalExp + amount);
            CalculatePlayerLevel();
            SaveToDisk();
        }

        public int GetExp()
        {
            EnsureSaveDataReady();
            return _saveData.totalExp;
        }

        public int GetPlayerLevel()
        {
            EnsureSaveDataReady();
            return _saveData.playerLevel;
        }

        private void CalculatePlayerLevel()
        {
            var exp = _saveData.totalExp;
            var level = 1;
            var requiredExp = 100;

            while (exp >= requiredExp && level < 100)
            {
                exp -= requiredExp;
                level++;
                requiredExp = Mathf.FloorToInt(requiredExp * 1.5f);
            }

            _saveData.playerLevel = level;
        }

        public void UnlockFabric(int fabricId)
        {
            EnsureSaveDataReady();
            if (!_saveData.unlockedFabrics.Contains(fabricId))
            {
                _saveData.unlockedFabrics.Add(fabricId);
                SaveToDisk();
            }
        }

        public bool IsFabricUnlocked(int fabricId)
        {
            EnsureSaveDataReady();
            return _saveData.unlockedFabrics.Contains(fabricId);
        }

        public void UnlockPattern(int patternId)
        {
            EnsureSaveDataReady();
            if (!_saveData.unlockedPatterns.Contains(patternId))
            {
                _saveData.unlockedPatterns.Add(patternId);
                SaveToDisk();
            }
        }

        public bool IsPatternUnlocked(int patternId)
        {
            EnsureSaveDataReady();
            return _saveData.unlockedPatterns.Contains(patternId);
        }

        private void SaveToDisk()
        {
            if (_isSaving) return;
            
            StartCoroutine(SaveToDiskAsync());
        }

        private System.Collections.IEnumerator SaveToDiskAsync()
        {
            _isSaving = true;
            
            try
            {
                _saveData.timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                
                var json = JsonUtility.ToJson(_saveData);
                var checksum = CalculateChecksum(json);

                PlayerPrefs.SetString(SaveKey, json);
                PlayerPrefs.SetString(ChecksumKey, checksum);
                
                if (PlayerPrefs.HasKey(BackupKey))
                {
                    var backupJson = PlayerPrefs.GetString(BackupKey);
                    var backupData = JsonUtility.FromJson<GameSaveData>(backupJson);
                    
                    if (backupData != null && _saveData.timestamp - backupData.timestamp > 300)
                    {
                        PlayerPrefs.SetString(BackupKey, json);
                    }
                }
                else
                {
                    PlayerPrefs.SetString(BackupKey, json);
                }

                PlayerPrefs.Save();
                
                yield return new WaitForSeconds(0.1f);
                
                if (!ValidateCurrentSave())
                {
                    Debug.LogError("Save validation failed!");
                    OnSaveError?.Invoke("Save validation failed");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save: {e.Message}");
                OnSaveError?.Invoke(e.Message);
            }
            finally
            {
                _isSaving = false;
            }
        }

        private string CalculateChecksum(string input)
        {
            using var md5 = MD5.Create();
            var saltedInput = input + HashSalt;
            var bytes = md5.ComputeHash(Encoding.UTF8.GetBytes(saltedInput));
            var builder = new StringBuilder();
            
            foreach (var b in bytes)
            {
                builder.Append(b.ToString("x2"));
            }
            
            return builder.ToString();
        }

        private bool ValidateCurrentSave()
        {
            if (!PlayerPrefs.HasKey(SaveKey) || !PlayerPrefs.HasKey(ChecksumKey))
            {
                return false;
            }

            try
            {
                var json = PlayerPrefs.GetString(SaveKey);
                var storedChecksum = PlayerPrefs.GetString(ChecksumKey);
                var actualChecksum = CalculateChecksum(json);

                return storedChecksum == actualChecksum;
            }
            catch
            {
                return false;
            }
        }

        private void EnsureSaveDataReady()
        {
            if (_saveData == null)
            {
                Debug.LogWarning("Save data not loaded yet! Using temporary data.");
                _saveData = new GameSaveData();
            }
            
            SanitizeSaveData(_saveData);
        }

        public void ResetSaveData()
        {
            _saveData = new GameSaveData
            {
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };
            SaveToDisk();
        }

        public string ExportSaveData()
        {
            EnsureSaveDataReady();
            return JsonUtility.ToJson(_saveData, true);
        }

        public bool ImportSaveData(string json)
        {
            try
            {
                var importedData = JsonUtility.FromJson<GameSaveData>(json);
                if (importedData == null)
                {
                    return false;
                }

                SanitizeSaveData(importedData);
                _saveData = importedData;
                SaveToDisk();
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"Import failed: {e.Message}");
                return false;
            }
        }

        public string ExportSaveToFile()
        {
            EnsureSaveDataReady();
            
            try
            {
                var path = Path.Combine(Application.persistentDataPath, "TieDyeSave.json");
                var json = JsonUtility.ToJson(_saveData, true);
                File.WriteAllText(path, json);
                return path;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to export save file: {e.Message}");
                return null;
            }
        }

        public bool ImportSaveFromFile(string path)
        {
            try
            {
                if (!File.Exists(path))
                {
                    return false;
                }

                var json = File.ReadAllText(path);
                return ImportSaveData(json);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to import save file: {e.Message}");
                return false;
            }
        }

        public bool IsSaveLoaded()
        {
            return _isLoaded;
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus && _isLoaded)
            {
                SaveToDisk();
            }
        }

        private void OnApplicationQuit()
        {
            if (_isLoaded)
            {
                SaveToDisk();
            }
        }
    }
}