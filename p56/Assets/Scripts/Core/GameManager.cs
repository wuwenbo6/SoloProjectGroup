using UnityEngine;
using UnityEngine.SceneManagement;
using TieDyeGame.Levels;

namespace TieDyeGame.Core
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("游戏状态")]
        public GameState currentState;
        public int currentLevelIndex = 0;

        public delegate void GameStateChanged(GameState newState);
        public event GameStateChanged OnGameStateChanged;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeGame();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeGame()
        {
            ChangeState(GameState.MainMenu);
        }

        public void ChangeState(GameState newState)
        {
            currentState = newState;
            OnGameStateChanged?.Invoke(newState);
        }

        public void LoadLevel(int levelIndex)
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.StartLevel(levelIndex);
            }
            else
            {
                currentLevelIndex = levelIndex;
                ChangeState(GameState.LevelPlaying);
                SceneManager.LoadScene("GameScene");
            }
        }

        public void ReturnToMenu()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.ReturnToMainMenu();
            }
            else
            {
                Time.timeScale = 1f;
                ChangeState(GameState.MainMenu);
                SceneManager.LoadScene("MainMenu");
            }
        }

        public void PauseGame()
        {
            if (currentState == GameState.LevelPlaying)
            {
                ChangeState(GameState.Paused);
                Time.timeScale = 0f;
            }
        }

        public void ResumeGame()
        {
            if (currentState == GameState.Paused)
            {
                ChangeState(GameState.LevelPlaying);
                Time.timeScale = 1f;
            }
        }

        private void OnApplicationQuit()
        {
            Time.timeScale = 1f;
        }
    }

    public enum GameState
    {
        MainMenu,
        LevelSelect,
        LevelPlaying,
        Paused,
        Gallery,
        Knowledge
    }
}
