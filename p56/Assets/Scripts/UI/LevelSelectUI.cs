using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Levels;
using TieDyeGame.Core;

namespace TieDyeGame.UI
{
    public class LevelSelectUI : MonoBehaviour
    {
        [Header("UI元素")]
        public Transform levelGrid;
        public GameObject levelButtonPrefab;
        public Text totalStarsText;
        public Button backButton;

        [Header("关卡详情面板")]
        public GameObject levelDetailPanel;
        public Text levelNameText;
        public Text levelDescriptionText;
        public Image levelIcon;
        public Text difficultyText;
        public Text objectiveText;
        public Button startLevelButton;
        public Button closeDetailButton;

        private LevelData selectedLevel;

        private void Start()
        {
            InitializeUI();
            CreateLevelButtons();
        }

        private void InitializeUI()
        {
            if (backButton != null)
                backButton.onClick.AddListener(BackToMenu);

            if (startLevelButton != null)
                startLevelButton.onClick.AddListener(StartSelectedLevel);

            if (closeDetailButton != null)
                closeDetailButton.onClick.AddListener(CloseLevelDetail);

            UpdateTotalStars();
        }

        private void UpdateTotalStars()
        {
            if (totalStarsText != null && LevelManager.Instance != null)
            {
                totalStarsText.text = $"总星星: {LevelManager.Instance.totalStars}";
            }
        }

        private void CreateLevelButtons()
        {
            if (LevelManager.Instance == null) return;

            foreach (Transform child in levelGrid)
            {
                Destroy(child.gameObject);
            }

            for (int i = 0; i < LevelManager.Instance.allLevels.Count; i++)
            {
                LevelData level = LevelManager.Instance.allLevels[i];
                CreateLevelButton(level, i);
            }
        }

        private void CreateLevelButton(LevelData level, int index)
        {
            GameObject buttonObj = Instantiate(levelButtonPrefab, levelGrid);
            Button button = buttonObj.GetComponent<Button>();
            LevelButton levelButton = buttonObj.GetComponent<LevelButton>();

            bool isUnlocked = level.IsUnlocked(LevelManager.Instance.totalStars);
            int stars = LevelManager.Instance.GetLevelStars(level.levelId);

            if (levelButton != null)
            {
                levelButton.Setup(level, isUnlocked, stars);
            }
            else
            {
                Text nameText = buttonObj.GetComponentInChildren<Text>();
                if (nameText != null)
                {
                    nameText.text = isUnlocked ? level.levelName : "???";
                }

                Image[] starsImages = buttonObj.GetComponentsInChildren<Image>();
                for (int i = 0; i < 3 && i < starsImages.Length; i++)
                {
                    starsImages[i].enabled = i < stars;
                }
            }

            button.interactable = isUnlocked;
            button.onClick.AddListener(() => OnLevelClicked(level));
        }

        private void OnLevelClicked(LevelData level)
        {
            selectedLevel = level;
            ShowLevelDetail(level);
        }

        private void ShowLevelDetail(LevelData level)
        {
            if (levelDetailPanel != null)
                levelDetailPanel.SetActive(true);

            if (levelNameText != null)
                levelNameText.text = level.levelName;

            if (levelDescriptionText != null)
                levelDescriptionText.text = level.description;

            if (levelIcon != null && level.levelIcon != null)
                levelIcon.sprite = level.levelIcon;

            if (difficultyText != null)
                difficultyText.text = $"难度: {level.difficultyLevel}";

            if (objectiveText != null)
            {
                string objectives = "";
                foreach (var obj in level.objectives)
                {
                    objectives += $"• {obj.description}\n";
                }
                objectiveText.text = objectives;
            }
        }

        private void CloseLevelDetail()
        {
            if (levelDetailPanel != null)
                levelDetailPanel.SetActive(false);

            selectedLevel = null;
        }

        private void StartSelectedLevel()
        {
            if (selectedLevel != null)
            {
                int index = LevelManager.Instance.allLevels.IndexOf(selectedLevel);
                LevelManager.Instance.StartLevel(index);
                SceneManager.LoadScene("GameScene");
            }
        }

        private void BackToMenu()
        {
            GameManager.Instance.ReturnToMenu();
            SceneManager.LoadScene("MainMenu");
        }
    }

    public class LevelButton : MonoBehaviour
    {
        public Text levelName;
        public Image[] starImages;
        public Image lockIcon;

        public void Setup(LevelData level, bool isUnlocked, int stars)
        {
            if (levelName != null)
                levelName.text = isUnlocked ? level.levelName : "???";

            if (lockIcon != null)
                lockIcon.enabled = !isUnlocked;

            for (int i = 0; i < starImages.Length; i++)
            {
                starImages[i].enabled = i < stars;
            }
        }
    }
}
