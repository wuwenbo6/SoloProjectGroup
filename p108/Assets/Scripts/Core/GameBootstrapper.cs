using UnityEngine;
using MortiseTenonGame.Core;
using MortiseTenonGame.Physics;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Levels;
using MortiseTenonGame.UI;
using MortiseTenonGame.Education;
using MortiseTenonGame.Scoring;

namespace MortiseTenonGame.Core
{
    public class GameBootstrapper : MonoBehaviour
    {
        [Header("Manager Prefabs")]
        [SerializeField] private GameObject _gameManagerPrefab;
        [SerializeField] private GameObject _physicsManagerPrefab;
        [SerializeField] private GameObject _pieceManagerPrefab;
        [SerializeField] private GameObject _levelManagerPrefab;
        [SerializeField] private GameObject _uiManagerPrefab;
        [SerializeField] private GameObject _knowledgeManagerPrefab;
        [SerializeField] private GameObject _hintManagerPrefab;
        [SerializeField] private GameObject _quizSystemPrefab;
        [SerializeField] private GameObject _scoringSystemPrefab;

        [Header("Input Handlers")]
        [SerializeField] private GameObject _dragHandlerPrefab;
        [SerializeField] private GameObject _rotationHandlerPrefab;

        private void Awake()
        {
            DontDestroyOnLoad(gameObject);
            InitializeManagers();
        }

        private void Start()
        {
            Debug.Log("=== Mortise & Tenon Game Initialized ===");
            Debug.Log($"Total Levels: {LevelManager.Instance.GetTotalLevels()}");
            Debug.Log($"Knowledge Items: {KnowledgeManager.Instance.KnowledgeBase.Count}");
            Debug.Log($"Quiz Categories: {QuizSystem.Instance.Categories.Count}");
        }

        private void InitializeManagers()
        {
            CreateManager<GameManager>(_gameManagerPrefab, "GameManager");
            CreateManager<PhysicsManager>(_physicsManagerPrefab, "PhysicsManager");
            CreateManager<PieceManager>(_pieceManagerPrefab, "PieceManager");
            CreateManager<LevelManager>(_levelManagerPrefab, "LevelManager");
            CreateManager<UIManager>(_uiManagerPrefab, "UIManager");
            CreateManager<KnowledgeManager>(_knowledgeManagerPrefab, "KnowledgeManager");
            CreateManager<HintManager>(_hintManagerPrefab, "HintManager");
            CreateManager<QuizSystem>(_quizSystemPrefab, "QuizSystem");
            CreateManager<ScoringSystem>(_scoringSystemPrefab, "ScoringSystem");

            CreateInputHandler<PieceDragHandler>(_dragHandlerPrefab, "PieceDragHandler");
            CreateInputHandler<PieceRotationHandler>(_rotationHandlerPrefab, "PieceRotationHandler");
        }

        private T CreateManager<T>(GameObject prefab, string name) where T : MonoBehaviour
        {
            T existing = FindObjectOfType<T>();
            if (existing != null)
            {
                return existing;
            }

            GameObject managerObj;
            if (prefab != null)
            {
                managerObj = Instantiate(prefab);
            }
            else
            {
                managerObj = new GameObject(name);
                managerObj.AddComponent<T>();
            }

            managerObj.name = name;
            DontDestroyOnLoad(managerObj);

            return managerObj.GetComponent<T>();
        }

        private T CreateInputHandler<T>(GameObject prefab, string name) where T : MonoBehaviour
        {
            T existing = FindObjectOfType<T>();
            if (existing != null)
            {
                return existing;
            }

            GameObject handlerObj;
            if (prefab != null)
            {
                handlerObj = Instantiate(prefab);
            }
            else
            {
                handlerObj = new GameObject(name);
                handlerObj.AddComponent<T>();
            }

            handlerObj.name = name;

            return handlerObj.GetComponent<T>();
        }

        private void Update()
        {
            CheckLevelCompletion();
        }

        private void CheckLevelCompletion()
        {
            if (GameManager.Instance.CurrentState == GameManager.GameState.Playing)
            {
                float progress = PieceManager.Instance.GetTotalConnectionProgress();
                UIManager.Instance.UpdateProgress(progress);
                LevelManager.Instance.CheckLevelCompletion();
            }
        }
    }
}