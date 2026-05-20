using UnityEngine;

namespace MortiseTenonGame.Core
{
    public class GameManager : Singleton<GameManager>
    {
        public enum GameState
        {
            Menu,
            Playing,
            Paused,
            LevelComplete,
            GameOver
        }

        public GameState CurrentState { get; private set; }

        public delegate void GameStateChanged(GameState newState);
        public event GameStateChanged OnGameStateChanged;

        protected override void Awake()
        {
            base.Awake();
            CurrentState = GameState.Menu;
        }

        public void ChangeState(GameState newState)
        {
            if (CurrentState == newState) return;

            CurrentState = newState;
            OnGameStateChanged?.Invoke(newState);
            Debug.Log($"Game State changed to: {newState}");
        }

        public void StartGame()
        {
            ChangeState(GameState.Playing);
        }

        public void PauseGame()
        {
            if (CurrentState == GameState.Playing)
            {
                ChangeState(GameState.Paused);
                Time.timeScale = 0;
            }
        }

        public void ResumeGame()
        {
            if (CurrentState == GameState.Paused)
            {
                ChangeState(GameState.Playing);
                Time.timeScale = 1;
            }
        }

        public void CompleteLevel()
        {
            ChangeState(GameState.LevelComplete);
        }

        public void ReturnToMenu()
        {
            ChangeState(GameState.Menu);
            Time.timeScale = 1;
        }
    }
}