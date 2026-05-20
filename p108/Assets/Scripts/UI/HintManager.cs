using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Physics;
using MortiseTenonGame.Levels;

namespace MortiseTenonGame.UI
{
    public class HintManager : Singleton<HintManager>
    {
        [Header("Hint Settings")]
        [SerializeField] private bool _enableHints = true;
        [SerializeField] private float _autoHintDelay = 15f;
        [SerializeField] private float _hintDuration = 5f;
        [SerializeField] private int _maxHintsPerLevel = 3;

        [Header("Visual Settings")]
        [SerializeField] private Color _positionHintColor = new Color(0, 1, 0, 0.6f);
        [SerializeField] private Color _rotationHintColor = new Color(0, 0.5f, 1, 0.6f);
        [SerializeField] private Color _connectionHintColor = new Color(1, 0.84f, 0, 0.6f);

        private HintAnimation _hintAnimation;
        private int _hintsUsed;
        private Coroutine _autoHintCoroutine;
        private List<MortiseTenonPiece> _piecesNeedingHints;

        public bool EnableHints { get => _enableHints; set => _enableHints = value; }
        public int HintsUsed => _hintsUsed;
        public int HintsRemaining => _maxHintsPerLevel - _hintsUsed;

        protected override void Awake()
        {
            base.Awake();
            InitializeHintAnimation();
        }

        private void InitializeHintAnimation()
        {
            GameObject hintObj = new GameObject("HintAnimation");
            hintObj.transform.SetParent(transform);
            _hintAnimation = hintObj.AddComponent<HintAnimation>();
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
            StopAllAutoHints();
        }

        private void OnLevelStarted()
        {
            _hintsUsed = 0;
            _piecesNeedingHints = new List<MortiseTenonPiece>();
            StopAllAutoHints();
            StartAutoHintSystem();
        }

        private void OnLevelCompleted()
        {
            StopAllAutoHints();
            HideAllHints();
        }

        public void ShowNextPieceHint()
        {
            if (!_enableHints || _hintsUsed >= _maxHintsPerLevel) return;

            var unplacedPiece = FindUnplacedPiece();
            if (unplacedPiece != null)
            {
                ShowPieceConnectionHint(unplacedPiece);
                _hintsUsed++;
            }
        }

        public void ShowPieceConnectionHint(MortiseTenonPiece piece)
        {
            if (piece == null) return;

            var joints = piece.GetComponentsInChildren<MortiseTenonJoint>();
            foreach (var joint in joints)
            {
                if (!joint.IsConnected)
                {
                    var matchingJoint = FindBestMatchingJoint(joint);
                    if (matchingJoint != null)
                    {
                        _hintAnimation.ShowDirectionalHint(joint, matchingJoint);
                        StartCoroutine(HideHintAfterDelay(_hintDuration));
                        return;
                    }
                }
            }

            ShowPiecePositionHint(piece);
        }

        public void ShowPiecePositionHint(MortiseTenonPiece piece)
        {
            if (piece == null) return;

            var pieceData = FindPieceDataInCurrentLevel(piece);
            if (pieceData != null)
            {
                GameObject targetMarker = new GameObject("TargetMarker");
                targetMarker.transform.position = pieceData.TargetPosition;
                targetMarker.transform.rotation = Quaternion.Euler(pieceData.TargetRotation);

                var joint = targetMarker.AddComponent<MortiseTenonJoint>();
                _hintAnimation.ShowHint(joint, HintType.All);

                StartCoroutine(DestroyMarkerAfterDelay(targetMarker, _hintDuration));
            }
        }

        public void ShowConnectionSuccessHint(MortiseTenonJoint joint1, MortiseTenonJoint joint2)
        {
            if (!_enableHints) return;

            Vector3 midPoint = (joint1.transform.position + joint2.transform.position) / 2;
            GameObject successObj = new GameObject("ConnectionSuccess");
            successObj.transform.position = midPoint;

            var particleSystem = successObj.AddComponent<ParticleSystem>();
            var main = particleSystem.main;
            main.startColor = _connectionHintColor;
            main.startSize = 0.1f;
            main.duration = 1f;
            main.loop = false;

            particleSystem.Play();
            Destroy(successObj, 1.5f);
        }

        public void ShowStepByStepHint()
        {
            if (!_enableHints || _hintsUsed >= _maxHintsPerLevel) return;

            var currentLevel = LevelManager.Instance.CurrentLevel;
            if (currentLevel == null) return;

            float progress = PieceManager.Instance.GetTotalConnectionProgress();

            if (progress < 0.3f)
            {
                ShowMessageHint("第一步：将第一个部件移动到大致位置");
            }
            else if (progress < 0.6f)
            {
                ShowMessageHint("第二步：调整部件角度，使榫头对齐卯眼");
            }
            else if (progress < 1f)
            {
                ShowMessageHint("第三步：微调位置使部件完全咬合");
            }
            else
            {
                ShowMessageHint("完成！你的榫卯结构非常完美！");
            }

            _hintsUsed++;
        }

        public void ShowMessageHint(string message)
        {
            UIManager.Instance.ShowHint("提示", message, _hintDuration);
        }

        public void HideAllHints()
        {
            _hintAnimation?.HideHint();
        }

        public void StartAutoHintSystem()
        {
            if (!_enableHints) return;
            StopAllAutoHints();
            _autoHintCoroutine = StartCoroutine(AutoHintRoutine());
        }

        public void StopAllAutoHints()
        {
            if (_autoHintCoroutine != null)
            {
                StopCoroutine(_autoHintCoroutine);
                _autoHintCoroutine = null;
            }
        }

        private System.Collections.IEnumerator AutoHintRoutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(_autoHintDelay);

                if (_hintsUsed < _maxHintsPerLevel && !LevelManager.Instance.LevelCompleted)
                {
                    var idlePiece = FindLongestIdlePiece();
                    if (idlePiece != null)
                    {
                        ShowPieceConnectionHint(idlePiece);
                        _hintsUsed++;
                    }
                }
            }
        }

        private MortiseTenonPiece FindUnplacedPiece()
        {
            var pieces = PieceManager.Instance.SpawnedPieces;
            foreach (var piece in pieces)
            {
                if (!piece.IsPlaced)
                {
                    return piece;
                }
            }
            return null;
        }

        private MortiseTenonJoint FindBestMatchingJoint(MortiseTenonJoint sourceJoint)
        {
            return PhysicsManager.Instance.FindBestMatchingJoint(sourceJoint, 2f);
        }

        private MortiseTenonPiece FindLongestIdlePiece()
        {
            return FindUnplacedPiece();
        }

        private LevelPieceData FindPieceDataInCurrentLevel(MortiseTenonPiece piece)
        {
            var level = LevelManager.Instance.CurrentLevel;
            if (level == null) return null;

            return level.Pieces.Find(p => p.PieceType == piece.PieceType);
        }

        private System.Collections.IEnumerator HideHintAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            _hintAnimation?.HideHint();
        }

        private System.Collections.IEnumerator DestroyMarkerAfterDelay(GameObject marker, float delay)
        {
            yield return new WaitForSeconds(delay);
            Destroy(marker);
        }

        public void ResetHints()
        {
            _hintsUsed = 0;
            HideAllHints();
        }
    }
}