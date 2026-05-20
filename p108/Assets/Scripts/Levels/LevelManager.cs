using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.UI;
using MortiseTenonGame.Education;

namespace MortiseTenonGame.Levels
{
    public class LevelManager : Singleton<LevelManager>
    {
        public delegate void LevelAction();
        public event LevelAction OnLevelStarted;
        public event LevelAction OnLevelCompleted;

        [Header("Level Settings")]
        [SerializeField] private TextAsset _levelsDataFile;
        [SerializeField] private Transform _piecesParent;
        [SerializeField] private Transform _targetZone;
        [SerializeField] private float _spawnDelayBetweenPieces = 0.1f;
        [SerializeField] private bool _useAsyncLoading = true;

        [Header("Scoring")]
        [SerializeField] private int _timeBonusPerSecond = 10;
        [SerializeField] private int _perfectConnectionBonus = 100;
        [SerializeField] private int _hintPenalty = 50;

        [Header("Hint System")]
        [SerializeField] private float _hintDelay = 5f;
        [SerializeField] private string[] _hintMessages;

        private List<LevelData> _allLevels = new List<LevelData>();
        private LevelData _currentLevel;
        private int _currentLevelIndex;
        private bool _levelCompleted;
        private bool _isLevelLoading;
        private Coroutine _currentLoadCoroutine;
        private float _levelStartTime;

        public LevelData CurrentLevel => _currentLevel;
        public int CurrentLevelIndex => _currentLevelIndex;
        public bool LevelCompleted => _levelCompleted;
        public bool IsLevelLoading => _isLevelLoading;
        public IReadOnlyList<LevelData> AllLevels => _allLevels.AsReadOnly();
        public float LevelElapsedTime => Time.time - _levelStartTime;
        public float LevelStartTime => _levelStartTime;

        protected override void Awake()
        {
            base.Awake();
            LoadLevelsData();
        }

        protected override void OnDestroy()
        {
            if (_currentLoadCoroutine != null)
            {
                StopCoroutine(_currentLoadCoroutine);
            }
            base.OnDestroy();
        }

        private void LoadLevelsData()
        {
            try
            {
                if (_levelsDataFile != null)
                {
                    Debug.Log("Levels data loaded from file");
                }
                else
                {
                    CreateDefaultLevels();
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to load levels data: {e.Message}");
                CreateDefaultLevels();
            }
        }

        private void CreateDefaultLevels()
        {
            _allLevels.Clear();
            _allLevels.Add(CreateLevel1());
            _allLevels.Add(CreateLevel2());
            _allLevels.Add(CreateLevel3());
            _allLevels.Add(CreateLevel4());
            _allLevels.Add(CreateLevel5());
        }

        private LevelData CreateLevel1()
        {
            return new LevelData
            {
                LevelId = 1,
                LevelName = "初识榫卯 - 直榫",
                Difficulty = LevelDifficulty.Beginner,
                Description = "学习最基础的直榫结构，将凸榫插入卯眼。\n操作：左键拖拽移动，右键旋转",
                TimeLimit = 180,
                BaseScore = 1000,
                Pieces = new List<LevelPieceData>
                {
                    new LevelPieceData
                    {
                        PieceId = "straight_tenon_1",
                        PieceType = PieceType.StraightTenon,
                        SpawnPosition = new Vector3(-1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "straight_mortise_1",
                        PieceType = PieceType.StraightTenon,
                        SpawnPosition = new Vector3(1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    }
                },
                KnowledgeId = "straight_tenon"
            };
        }

        private LevelData CreateLevel2()
        {
            return new LevelData
            {
                LevelId = 2,
                LevelName = "L型接合",
                Difficulty = LevelDifficulty.Easy,
                Description = "使用L型榫卯结构连接两个木件。\n提示：注意对齐角度，使用右键调整旋转",
                TimeLimit = 240,
                BaseScore = 1500,
                Pieces = new List<LevelPieceData>
                {
                    new LevelPieceData
                    {
                        PieceId = "l_tenon_1",
                        PieceType = PieceType.LShapedTenon,
                        SpawnPosition = new Vector3(-1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "l_mortise_1",
                        PieceType = PieceType.LShapedTenon,
                        SpawnPosition = new Vector3(1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    }
                },
                KnowledgeId = "l_shaped"
            };
        }

        private LevelData CreateLevel3()
        {
            return new LevelData
            {
                LevelId = 3,
                LevelName = "T型结构",
                Difficulty = LevelDifficulty.Medium,
                Description = "组装一个T型榫卯结构，三个方向连接。\n技巧：先固定中心部件，再连接两侧",
                TimeLimit = 300,
                BaseScore = 2000,
                Pieces = new List<LevelPieceData>
                {
                    new LevelPieceData
                    {
                        PieceId = "t_main",
                        PieceType = PieceType.TShapedTenon,
                        SpawnPosition = new Vector3(0, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "t_cross_1",
                        PieceType = PieceType.TShapedTenon,
                        SpawnPosition = new Vector3(-1.5f, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "t_cross_2",
                        PieceType = PieceType.TShapedTenon,
                        SpawnPosition = new Vector3(1.5f, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    }
                },
                KnowledgeId = "t_shaped"
            };
        }

        private LevelData CreateLevel4()
        {
            return new LevelData
            {
                LevelId = 4,
                LevelName = "燕尾榫",
                Difficulty = LevelDifficulty.Hard,
                Description = "燕尾榫是一种美观且牢固的接合方式。\n注意：燕尾形状需要精确对齐",
                TimeLimit = 360,
                BaseScore = 3000,
                Pieces = new List<LevelPieceData>
                {
                    new LevelPieceData
                    {
                        PieceId = "dovetail_1",
                        PieceType = PieceType.DovetailTenon,
                        SpawnPosition = new Vector3(-1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "dovetail_2",
                        PieceType = PieceType.DovetailTenon,
                        SpawnPosition = new Vector3(1, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    }
                },
                KnowledgeId = "dovetail"
            };
        }

        private LevelData CreateLevel5()
        {
            return new LevelData
            {
                LevelId = 5,
                LevelName = "斗拱初探",
                Difficulty = LevelDifficulty.Expert,
                Description = "斗拱是中国古代建筑的精髓，由多个部件组成。\n步骤：先放置底座，再逐层叠加",
                TimeLimit = 600,
                BaseScore = 5000,
                Pieces = new List<LevelPieceData>
                {
                    new LevelPieceData
                    {
                        PieceId = "dougong_base",
                        PieceType = PieceType.BracketArch,
                        SpawnPosition = new Vector3(0, 0.2f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.2f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "dougong_tier1",
                        PieceType = PieceType.DougongTier,
                        SpawnPosition = new Vector3(-2, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    },
                    new LevelPieceData
                    {
                        PieceId = "dougong_tier2",
                        PieceType = PieceType.DougongTier,
                        SpawnPosition = new Vector3(2, 0.5f, 0),
                        SpawnRotation = Vector3.zero,
                        TargetPosition = new Vector3(0, 0.5f, 0),
                        TargetRotation = Vector3.zero
                    }
                },
                KnowledgeId = "dougong"
            };
        }

        public void StartLevel(int levelIndex)
        {
            if (_isLevelLoading)
            {
                Debug.LogWarning("Already loading a level, please wait");
                return;
            }

            if (levelIndex < 0 || levelIndex >= _allLevels.Count)
            {
                Debug.LogError("Invalid level index!");
                return;
            }

            if (_useAsyncLoading)
            {
                _currentLoadCoroutine = StartCoroutine(StartLevelAsync(levelIndex));
            }
            else
            {
                StartLevelImmediate(levelIndex);
            }
        }

        private IEnumerator StartLevelAsync(int levelIndex)
        {
            _isLevelLoading = true;
            Debug.Log($"Starting to load level {levelIndex}...");

            yield return null;

            try
            {
                _currentLevelIndex = levelIndex;
                _currentLevel = _allLevels[levelIndex];
                _levelCompleted = false;

                yield return StartCoroutine(ClearLevelAsync());

                UIManager.Instance.UpdateLevelName(_currentLevel.LevelName);
                UIManager.Instance.UpdateProgress(0f);

                yield return StartCoroutine(SpawnLevelPiecesAsync());

                if (!string.IsNullOrEmpty(_currentLevel.KnowledgeId))
                {
                    KnowledgeManager.Instance.ShowKnowledge(_currentLevel.KnowledgeId);
                }

                GameManager.Instance.StartGame();

                System.GC.Collect();
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to load level: {e.Message}\n{e.StackTrace}");
                _isLevelLoading = false;
                yield break;
            }

            _isLevelLoading = false;
            Debug.Log($"Level {levelIndex} loaded successfully");
        }

        private void StartLevelImmediate(int levelIndex)
        {
            try
            {
                _currentLevelIndex = levelIndex;
                _currentLevel = _allLevels[levelIndex];
                _levelCompleted = false;
                _levelStartTime = Time.time;

                PieceManager.Instance.DestroyAllPieces();
                SpawnLevelPieces();

                UIManager.Instance.UpdateLevelName(_currentLevel.LevelName);
                UIManager.Instance.UpdateProgress(0f);

                if (!string.IsNullOrEmpty(_currentLevel.KnowledgeId))
                {
                    KnowledgeManager.Instance.ShowKnowledge(_currentLevel.KnowledgeId);
                }

                GameManager.Instance.StartGame();
                OnLevelStarted?.Invoke();
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to start level immediately: {e.Message}");
            }
        }

        private IEnumerator ClearLevelAsync()
        {
            try
            {
                PieceManager.Instance.DestroyAllPieces();
                yield return new WaitForEndOfFrame();
                yield return null;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error clearing level: {e.Message}");
            }
        }

        private IEnumerator SpawnLevelPiecesAsync()
        {
            if (_currentLevel == null || _currentLevel.Pieces == null)
            {
                yield break;
            }

            foreach (var pieceData in _currentLevel.Pieces)
            {
                try
                {
                    Quaternion rotation = Quaternion.Euler(pieceData.SpawnRotation);
                    var piece = PieceManager.Instance.SpawnPiece(
                        pieceData.PieceType, 
                        pieceData.SpawnPosition, 
                        rotation
                    );

                    if (piece != null && _piecesParent != null)
                    {
                        piece.transform.SetParent(_piecesParent, true);
                    }

                    yield return new WaitForSeconds(_spawnDelayBetweenPieces);
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"Failed to spawn piece {pieceData?.PieceId}: {e.Message}");
                    continue;
                }
            }
        }

        private void SpawnLevelPieces()
        {
            if (_currentLevel == null || _currentLevel.Pieces == null) return;

            foreach (var pieceData in _currentLevel.Pieces)
            {
                try
                {
                    Quaternion rotation = Quaternion.Euler(pieceData.SpawnRotation);
                    var piece = PieceManager.Instance.SpawnPiece(
                        pieceData.PieceType, 
                        pieceData.SpawnPosition, 
                        rotation
                    );

                    if (piece != null && _piecesParent != null)
                    {
                        piece.transform.SetParent(_piecesParent, true);
                    }
                }
                catch (System.Exception e)
                {
                    Debug.LogError($"Failed to spawn piece {pieceData?.PieceId}: {e.Message}");
                }
            }
        }

        public void ResetLevel()
        {
            if (_currentLevel != null && !_isLevelLoading)
            {
                StartLevel(_currentLevelIndex);
            }
        }

        public void NextLevel()
        {
            if (_isLevelLoading) return;

            if (_currentLevelIndex < _allLevels.Count - 1)
            {
                StartLevel(_currentLevelIndex + 1);
                UIManager.Instance.ShowGameUI();
            }
            else
            {
                UIManager.Instance.ShowMainMenu();
                Debug.Log("All levels completed!");
            }
        }

        public void CheckLevelCompletion()
        {
            if (_levelCompleted || _isLevelLoading) return;

            try
            {
                if (PieceManager.Instance.AreAllPiecesConnected())
                {
                    CompleteLevel();
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error checking level completion: {e.Message}");
            }
        }

        private void CompleteLevel()
        {
            try
            {
                _levelCompleted = true;

                int score = CalculateScore();
                float time = UIManager.Instance.GetCurrentTime();
                int connections = PieceManager.Instance.GetTotalConnections();

                int stars = CalculateStars(score, time, connections);

                MortiseTenonGame.SaveSystem.SaveManager.CompleteLevel(
                    _currentLevel.LevelId,
                    score,
                    time,
                    stars
                );

                UIManager.Instance.ShowLevelComplete(score, time, connections);
                OnLevelCompleted?.Invoke();
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error completing level: {e.Message}");
                _levelCompleted = false;
            }
        }

        private int CalculateStars(int score, float time, int connections)
        {
            int stars = 1;

            float baseScore = _currentLevel.BaseScore;
            if (score >= baseScore * 1.2f)
            {
                stars = 3;
            }
            else if (score >= baseScore * 1.1f)
            {
                stars = 2;
            }

            return stars;
        }

        private int CalculateScore()
        {
            if (_currentLevel == null) return 0;

            int score = _currentLevel.BaseScore;

            try
            {
                float timeUsed = UIManager.Instance.GetCurrentTime();
                if (timeUsed < _currentLevel.TimeLimit)
                {
                    score += Mathf.FloorToInt((_currentLevel.TimeLimit - timeUsed) * _timeBonusPerSecond);
                }

                float progress = PieceManager.Instance.GetTotalConnectionProgress();
                if (progress >= 1f)
                {
                    score += _perfectConnectionBonus;
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error calculating score: {e.Message}");
            }

            return score;
        }

        public void ShowHint()
        {
            if (_currentLevel != null)
            {
                Debug.Log($"Hint: {_currentLevel.Description}");
            }
            else
            {
                Debug.Log("No active level to show hint for");
            }
        }

        public int GetTotalLevels()
        {
            return _allLevels.Count;
        }

        public LevelData GetLevelData(int levelIndex)
        {
            if (levelIndex >= 0 && levelIndex < _allLevels.Count)
            {
                return _allLevels[levelIndex];
            }
            return null;
        }
    }
}