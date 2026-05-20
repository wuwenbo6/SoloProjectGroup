using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Core;

namespace TieDyeGame.UI
{
    public class MainMenuUI : MonoBehaviour
    {
        [Header("按钮引用")]
        public Button startGameButton;
        public Button levelSelectButton;
        public Button galleryButton;
        public Button knowledgeButton;
        public Button settingsButton;
        public Button quitButton;

        [Header("面板引用")]
        public GameObject mainMenuPanel;
        public GameObject settingsPanel;

        [Header("设置面板")]
        public Slider musicVolumeSlider;
        public Slider sfxVolumeSlider;
        public Toggle fullscreenToggle;
        public Button applySettingsButton;
        public Button backToMenuButton;

        private void Start()
        {
            InitializeButtons();
            LoadSettings();
        }

        private void InitializeButtons()
        {
            if (startGameButton != null)
                startGameButton.onClick.AddListener(StartGame);

            if (levelSelectButton != null)
                levelSelectButton.onClick.AddListener(OpenLevelSelect);

            if (galleryButton != null)
                galleryButton.onClick.AddListener(OpenGallery);

            if (knowledgeButton != null)
                knowledgeButton.onClick.AddListener(OpenKnowledge);

            if (settingsButton != null)
                settingsButton.onClick.AddListener(OpenSettings);

            if (quitButton != null)
                quitButton.onClick.AddListener(QuitGame);

            if (applySettingsButton != null)
                applySettingsButton.onClick.AddListener(ApplySettings);

            if (backToMenuButton != null)
                backToMenuButton.onClick.AddListener(CloseSettings);
        }

        private void StartGame()
        {
            if (LevelManager.Instance != null && LevelManager.Instance.allLevels.Count > 0)
            {
                LevelManager.Instance.StartLevel(0);
            }
            else
            {
                SceneManager.LoadScene("GameScene");
            }
        }

        private void OpenLevelSelect()
        {
            GameManager.Instance.ChangeState(GameState.LevelSelect);
            SceneManager.LoadScene("LevelSelect");
        }

        private void OpenGallery()
        {
            GameManager.Instance.ChangeState(GameState.Gallery);
            SceneManager.LoadScene("Gallery");
        }

        private void OpenKnowledge()
        {
            GameManager.Instance.ChangeState(GameState.Knowledge);
            SceneManager.LoadScene("Knowledge");
        }

        private void OpenSettings()
        {
            mainMenuPanel.SetActive(false);
            settingsPanel.SetActive(true);
        }

        private void CloseSettings()
        {
            settingsPanel.SetActive(false);
            mainMenuPanel.SetActive(true);
        }

        private void LoadSettings()
        {
            if (musicVolumeSlider != null)
                musicVolumeSlider.value = PlayerPrefs.GetFloat("MusicVolume", 0.7f);

            if (sfxVolumeSlider != null)
                sfxVolumeSlider.value = PlayerPrefs.GetFloat("SFXVolume", 0.8f);

            if (fullscreenToggle != null)
                fullscreenToggle.isOn = PlayerPrefs.GetInt("Fullscreen", 1) == 1;
        }

        private void ApplySettings()
        {
            if (musicVolumeSlider != null)
                PlayerPrefs.SetFloat("MusicVolume", musicVolumeSlider.value);

            if (sfxVolumeSlider != null)
                PlayerPrefs.SetFloat("SFXVolume", sfxVolumeSlider.value);

            if (fullscreenToggle != null)
            {
                PlayerPrefs.SetInt("Fullscreen", fullscreenToggle.isOn ? 1 : 0);
                Screen.fullScreen = fullscreenToggle.isOn;
            }

            PlayerPrefs.Save();
        }

        private void QuitGame()
        {
            Application.Quit();
        }
    }
}
