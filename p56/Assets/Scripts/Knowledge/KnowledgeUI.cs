using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Core;

namespace TieDyeGame.Knowledge
{
    public class KnowledgeUI : MonoBehaviour
    {
        [Header("分类选项卡")]
        public Toggle historyToggle;
        public Toggle techniqueToggle;
        public Toggle materialToggle;
        public Toggle cultureToggle;

        [Header("内容显示")]
        public Transform contentGrid;
        public GameObject knowledgeItemPrefab;

        [Header("详情面板")]
        public GameObject detailPanel;
        public Text titleText;
        public Text categoryText;
        public Text contentText;
        public Button closeDetailButton;

        [Header("导航")]
        public Button backButton;
        public Text lockedHintText;

        private KnowledgeCategory currentCategory = KnowledgeCategory.History;
        private KnowledgeItem selectedItem;

        private void Start()
        {
            InitializeUI();
            SetupToggleEvents();
            ShowCategory(currentCategory);
        }

        private void InitializeUI()
        {
            if (backButton != null)
                backButton.onClick.AddListener(BackToMenu);

            if (closeDetailButton != null)
                closeDetailButton.onClick.AddListener(CloseDetailPanel);

            if (lockedHintText != null)
                lockedHintText.enabled = false;
        }

        private void SetupToggleEvents()
        {
            if (historyToggle != null)
                historyToggle.onValueChanged.AddListener((isOn) => { if (isOn) ShowCategory(KnowledgeCategory.History); });

            if (techniqueToggle != null)
                techniqueToggle.onValueChanged.AddListener((isOn) => { if (isOn) ShowCategory(KnowledgeCategory.Technique); });

            if (materialToggle != null)
                materialToggle.onValueChanged.AddListener((isOn) => { if (isOn) ShowCategory(KnowledgeCategory.Material); });

            if (cultureToggle != null)
                cultureToggle.onValueChanged.AddListener((isOn) => { if (isOn) ShowCategory(KnowledgeCategory.Culture); });
        }

        private void ShowCategory(KnowledgeCategory category)
        {
            currentCategory = category;

            foreach (Transform child in contentGrid)
            {
                Destroy(child.gameObject);
            }

            if (KnowledgeManager.Instance == null) return;

            var items = KnowledgeManager.Instance.GetKnowledgeByCategory(category);

            foreach (var item in items)
            {
                CreateKnowledgeItem(item);
            }
        }

        private void CreateKnowledgeItem(KnowledgeItem item)
        {
            GameObject itemObj = Instantiate(knowledgeItemPrefab, contentGrid);

            Text titleText = itemObj.transform.Find("TitleText")?.GetComponent<Text>();
            if (titleText != null)
                titleText.text = item.title;

            Image lockIcon = itemObj.transform.Find("LockIcon")?.GetComponent<Image>();
            if (lockIcon != null)
                lockIcon.enabled = !item.isUnlocked;

            Button btn = itemObj.GetComponent<Button>();
            if (btn != null)
            {
                if (item.isUnlocked)
                {
                    btn.onClick.AddListener(() => ShowKnowledgeDetail(item));
                }
                else
                {
                    btn.onClick.AddListener(() => ShowLockedHint(item));
                }
            }
        }

        private void ShowKnowledgeDetail(KnowledgeItem item)
        {
            selectedItem = item;

            if (detailPanel != null)
                detailPanel.SetActive(true);

            if (titleText != null)
                titleText.text = item.title;

            if (categoryText != null)
                categoryText.text = GetCategoryName(item.category);

            if (contentText != null)
                contentText.text = item.content;
        }

        private void ShowLockedHint(KnowledgeItem item)
        {
            if (lockedHintText != null)
            {
                lockedHintText.text = $"该知识需要达到等级{item.unlockLevel}才能解锁\n继续完成关卡来解锁更多内容！";
                lockedHintText.enabled = true;
                Invoke(nameof(HideLockedHint), 3f);
            }
        }

        private void HideLockedHint()
        {
            if (lockedHintText != null)
                lockedHintText.enabled = false;
        }

        private void CloseDetailPanel()
        {
            if (detailPanel != null)
                detailPanel.SetActive(false);

            selectedItem = null;
        }

        private string GetCategoryName(KnowledgeCategory category)
        {
            switch (category)
            {
                case KnowledgeCategory.History:
                    return "历史渊源";
                case KnowledgeCategory.Technique:
                    return "工艺技法";
                case KnowledgeCategory.Material:
                    return "材料知识";
                case KnowledgeCategory.Culture:
                    return "文化传承";
                default:
                    return "其他";
            }
        }

        private void BackToMenu()
        {
            GameManager.Instance.ReturnToMenu();
            SceneManager.LoadScene("MainMenu");
        }
    }
}
