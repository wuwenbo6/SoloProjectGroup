using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Levels;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.Scoring
{
    public class ScoringSystem : Singleton<ScoringSystem>
    {
        [Header("Score Weights")]
        [SerializeField] private int _baseScore = 1000;
        [SerializeField] private float _timeWeight = 0.3f;
        [SerializeField] private float _accuracyWeight = 0.3f;
        [SerializeField] private float _connectionWeight = 0.25f;
        [SerializeField] private float _stabilityWeight = 0.15f;

        [Header("Penalties")]
        [SerializeField] private int _hintPenalty = 50;
        [SerializeField] private int _undoPenalty = 20;
        [SerializeField] private int _resetPenalty = 100;

        [Header("Bonuses")]
        [SerializeField] private int _perfectBonus = 200;
        [SerializeField] private int _speedBonus = 150;
        [SerializeField] private int _noHintBonus = 100;

        [Header("Time Settings")]
        [SerializeField] private float _parTime = 60f;
        [SerializeField] private float _maxTimeBonus = 300f;

        private int _totalScore;
        private float _accuracyScore;
        private float _timeScore;
        private float _connectionScore;
        private float _stabilityScore;
        private int _penalties;
        private int _bonuses;
        private int _hintsUsed;
        private int _undoCount;
        private int _resetCount;
        private List<string> _scoreBreakdown = new List<string>();

        public int TotalScore => _totalScore;
        public float AccuracyScore => _accuracyScore;
        public float TimeScore => _timeScore;
        public float ConnectionScore => _connectionScore;
        public float StabilityScore => _stabilityScore;
        public int Penalties => _penalties;
        public int Bonuses => _bonuses;
        public IReadOnlyList<string> ScoreBreakdown => _scoreBreakdown.AsReadOnly();

        protected override void Awake()
        {
            base.Awake();
        }

        private void OnEnable()
        {
            LevelManager.Instance.OnLevelStarted += OnLevelStarted;
            LevelManager.Instance.OnLevelCompleted += OnLevelCompleted;
        }

        private void OnDisable()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelStarted -= OnLevelStarted;
                LevelManager.Instance.OnLevelCompleted -= OnLevelCompleted;
            }
        }

        private void OnLevelStarted()
        {
            ResetScore();
        }

        private void OnLevelCompleted()
        {
            CalculateFinalScore();
        }

        public void ResetScore()
        {
            _totalScore = 0;
            _accuracyScore = 0;
            _timeScore = 0;
            _connectionScore = 0;
            _stabilityScore = 0;
            _penalties = 0;
            _bonuses = 0;
            _hintsUsed = 0;
            _undoCount = 0;
            _resetCount = 0;
            _scoreBreakdown.Clear();
        }

        public void RecordHintUsed()
        {
            _hintsUsed++;
        }

        public void RecordUndo()
        {
            _undoCount++;
        }

        public void RecordReset()
        {
            _resetCount++;
        }

        public int CalculateFinalScore()
        {
            _scoreBreakdown.Clear();

            CalculateAccuracyScore();
            CalculateTimeScore();
            CalculateConnectionScore();
            CalculateStabilityScore();
            CalculatePenalties();
            CalculateBonuses();

            _totalScore = Mathf.RoundToInt(
                _accuracyScore +
                _timeScore +
                _connectionScore +
                _stabilityScore +
                _bonuses -
                _penalties
            );

            _totalScore = Mathf.Max(0, _totalScore);

            GenerateScoreBreakdown();

            return _totalScore;
        }

        private void CalculateAccuracyScore()
        {
            float maxAccuracyScore = _baseScore * _accuracyWeight;
            float totalAccuracy = 0f;
            int pieceCount = 0;

            var pieces = PieceManager.Instance.SpawnedPieces;
            foreach (var piece in pieces)
            {
                if (piece != null)
                {
                    float pieceAccuracy = CalculatePieceAccuracy(piece);
                    totalAccuracy += pieceAccuracy;
                    pieceCount++;
                }
            }

            float averageAccuracy = pieceCount > 0 ? totalAccuracy / pieceCount : 0f;
            _accuracyScore = averageAccuracy * maxAccuracyScore;
        }

        private float CalculatePieceAccuracy(MortiseTenonPiece piece)
        {
            if (piece == null) return 0f;

            var level = LevelManager.Instance.CurrentLevel;
            if (level == null) return 0f;

            var pieceData = level.Pieces.Find(p => p.PieceType == piece.PieceType);
            if (pieceData == null) return 0f;

            float positionError = Vector3.Distance(
                piece.transform.position,
                pieceData.TargetPosition
            );

            float rotationError = Quaternion.Angle(
                piece.transform.rotation,
                Quaternion.Euler(pieceData.TargetRotation)
            );

            float positionAccuracy = Mathf.Clamp01(1 - positionError / 0.1f);
            float rotationAccuracy = Mathf.Clamp01(1 - rotationError / 15f);

            return (positionAccuracy + rotationAccuracy) / 2f;
        }

        private void CalculateTimeScore()
        {
            float maxTimeScore = _baseScore * _timeWeight;
            float elapsedTime = UIManager.Instance.GetCurrentTime();

            if (elapsedTime <= _parTime)
            {
                _timeScore = maxTimeScore;
            }
            else
            {
                float timeRatio = Mathf.Clamp01(1 - (elapsedTime - _parTime) / (_parTime * 2));
                _timeScore = timeRatio * maxTimeScore;
            }
        }

        private void CalculateConnectionScore()
        {
            float maxConnectionScore = _baseScore * _connectionWeight;
            float progress = PieceManager.Instance.GetTotalConnectionProgress();
            _connectionScore = progress * maxConnectionScore;
        }

        private void CalculateStabilityScore()
        {
            float maxStabilityScore = _baseScore * _stabilityWeight;
            float stability = PhysicsManager.Instance.CalculateStability();
            _stabilityScore = stability * maxStabilityScore;
        }

        private void CalculatePenalties()
        {
            _penalties = 0;
            _penalties += _hintsUsed * _hintPenalty;
            _penalties += _undoCount * _undoPenalty;
            _penalties += _resetCount * _resetPenalty;
        }

        private void CalculateBonuses()
        {
            _bonuses = 0;

            float progress = PieceManager.Instance.GetTotalConnectionProgress();
            if (progress >= 1f)
            {
                _bonuses += _perfectBonus;
            }

            float elapsedTime = UIManager.Instance.GetCurrentTime();
            if (elapsedTime < _parTime * 0.5f)
            {
                _bonuses += _speedBonus;
            }

            if (_hintsUsed == 0)
            {
                _bonuses += _noHintBonus;
            }
        }

        private void GenerateScoreBreakdown()
        {
            _scoreBreakdown.Add($"基础分: {_baseScore}");
            _scoreBreakdown.Add($"精度分: {Mathf.RoundToInt(_accuracyScore)}");
            _scoreBreakdown.Add($"时间分: {Mathf.RoundToInt(_timeScore)}");
            _scoreBreakdown.Add($"连接分: {Mathf.RoundToInt(_connectionScore)}");
            _scoreBreakdown.Add($"稳定分: {Mathf.RoundToInt(_stabilityScore)}");

            if (_bonuses > 0)
            {
                _scoreBreakdown.Add($"奖励分: +{_bonuses}");
            }

            if (_penalties > 0)
            {
                _scoreBreakdown.Add($"惩罚分: -{_penalties}");
            }

            _scoreBreakdown.Add($"总分: {_totalScore}");
        }

        public int CalculateStars()
        {
            float percentage = (float)_totalScore / _baseScore;

            if (percentage >= 1.5f) return 3;
            if (percentage >= 1.0f) return 2;
            if (percentage >= 0.5f) return 1;
            return 0;
        }

        public string GetPerformanceGrade()
        {
            int stars = CalculateStars();

            switch (stars)
            {
                case 3: return "大师级";
                case 2: return "熟练级";
                case 1: return "入门级";
                default: return "继续努力";
            }
        }

        public string GetDetailedFeedback()
        {
            string feedback = "";

            float progress = PieceManager.Instance.GetTotalConnectionProgress();
            if (progress >= 1f)
            {
                feedback += "完美的连接精度！";
            }
            else if (progress >= 0.8f)
            {
                feedback += "连接精度不错，还有提升空间。";
            }
            else
            {
                feedback += "需要提升连接精度，注意对齐。";
            }

            float elapsedTime = UIManager.Instance.GetCurrentTime();
            if (elapsedTime < _parTime * 0.5f)
            {
                feedback += " 手速惊人！";
            }
            else if (elapsedTime < _parTime)
            {
                feedback += " 完成速度适中。";
            }
            else
            {
                feedback += " 可以尝试更快完成。";
            }

            if (_hintsUsed == 0)
            {
                feedback += " 独立完成，非常棒！";
            }

            return feedback;
        }

        public void ShowScoreUI()
        {
            string breakdown = string.Join("\n", _scoreBreakdown);
            string grade = GetPerformanceGrade();
            string feedback = GetDetailedFeedback();

            UIManager.Instance.ShowHint(
                "评分结果",
                $"等级: {grade}\n\n{breakdown}\n\n评价: {feedback}",
                10f
            );
        }
    }
}