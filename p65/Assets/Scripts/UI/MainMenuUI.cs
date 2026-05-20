using UnityEngine;
using UnityEngine.SceneManagement;

namespace TieDyeGame.UI
{
    public class MainMenuUI : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private GameObject mainMenuPanel;
        [SerializeField] private GameObject levelSelectPanel;
        [SerializeField] private GameObject knowledgePanel;
        [SerializeField] private GameObject settingsPanel;

        [Header("Player Info")]
        [SerializeField] private TMPro.TMP_Text levelText;
        [SerializeField] private TMPro.TMP_Text coinsText;
        [SerializeField] private TMPro.TMP_Text expText;

        private void Start()
        {
            ShowMainMenu();
            UpdatePlayerInfo();
        }

        private void UpdatePlayerInfo()
        {
            if (Save.LevelSaveData.Instance == null) return;
            
            levelText.text = $"Lv.{Save.LevelSaveData.Instance.GetPlayerLevel()}";
            coinsText.text = Save.LevelSaveData.Instance.GetCoins().ToString();
            expText.text = $"{Save.LevelSaveData.Instance.GetExp()} EXP";
        }

        public void ShowMainMenu()
        {
            HideAllPanels();
            mainMenuPanel.SetActive(true);
        }

        public void ShowLevelSelect()
        {
            HideAllPanels();
            levelSelectPanel.SetActive(true);
        }

        public void ShowKnowledge()
        {
            HideAllPanels();
            knowledgePanel.SetActive(true);
        }

        public void ShowSettings()
        {
            HideAllPanels();
            settingsPanel.SetActive(true);
        }

        private void HideAllPanels()
        {
            mainMenuPanel.SetActive(false);
            levelSelectPanel.SetActive(false);
            knowledgePanel.SetActive(false);
            settingsPanel.SetActive(false);
        }

        public void StartGame()
        {
            ShowLevelSelect();
        }

        public void OpenLevel(int levelId)
        {
            PlayerPrefs.SetInt("SelectedLevel", levelId);
            SceneManager.LoadScene("GameScene");
        }

        public void OpenFreeMode()
        {
            PlayerPrefs.SetInt("SelectedLevel", -1);
            SceneManager.LoadScene("GameScene");
        }

        public void QuitGame()
        {
            Application.Quit();
        }
    }
}