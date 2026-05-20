using UnityEngine;
using UnityEngine.UI;

namespace TieDyeGame.Knowledge
{
    public class KnowledgeManager : MonoBehaviour
    {
        [Header("Knowledge Database")]
        public TieDyeKnowledge[] allKnowledgeItems;

        [Header("UI References")]
        [SerializeField] private Transform knowledgeItemContainer;
        [SerializeField] private GameObject knowledgeItemPrefab;
        [SerializeField] private GameObject detailPanel;
        [SerializeField] private TMPro.TMP_Text detailTitle;
        [SerializeField] private TMPro.TMP_Text detailContent;
        [SerializeField] private Image detailIllustration;
        [SerializeField] private Button[] categoryButtons;

        private KnowledgeCategory _currentCategory = KnowledgeCategory.History;

        private void Start()
        {
            SetupCategoryButtons();
            RefreshKnowledgeList();
        }

        private void SetupCategoryButtons()
        {
            for (var i = 0; i < categoryButtons.Length && i < 5; i++)
            {
                var category = (KnowledgeCategory)i;
                var button = categoryButtons[i];
                button.onClick.AddListener(() => SelectCategory(category));
                
                var text = button.GetComponentInChildren<TMPro.TMP_Text>();
                if (text != null)
                {
                    text.text = category.ToString();
                }
            }
        }

        private void SelectCategory(KnowledgeCategory category)
        {
            _currentCategory = category;
            RefreshKnowledgeList();
        }

        private void RefreshKnowledgeList()
        {
            foreach (Transform child in knowledgeItemContainer)
            {
                Destroy(child.gameObject);
            }

            foreach (var knowledge in allKnowledgeItems)
            {
                if (knowledge.category != _currentCategory) continue;
                
                var item = Instantiate(knowledgeItemPrefab, knowledgeItemContainer);
                var button = item.GetComponent<Button>();
                var titleText = item.GetComponentInChildren<TMPro.TMP_Text>();
                
                titleText.text = knowledge.title;
                
                var playerLevel = Save.LevelSaveData.Instance?.GetPlayerLevel() ?? 1;
                var isUnlocked = playerLevel >= knowledge.unlockLevel;
                
                button.interactable = isUnlocked;
                
                if (!isUnlocked)
                {
                    titleText.text += $" (Unlock at Lv.{knowledge.unlockLevel})";
                    titleText.color = Color.gray;
                }
                
                button.onClick.AddListener(() => ShowKnowledgeDetail(knowledge));
            }
        }

        private void ShowKnowledgeDetail(TieDyeKnowledge knowledge)
        {
            detailPanel.SetActive(true);
            detailTitle.text = knowledge.title;
            detailContent.text = knowledge.content;
            
            if (knowledge.illustration != null)
            {
                detailIllustration.sprite = knowledge.illustration;
                detailIllustration.gameObject.SetActive(true);
            }
            else
            {
                detailIllustration.gameObject.SetActive(false);
            }
        }

        public void CloseDetailPanel()
        {
            detailPanel.SetActive(false);
        }
    }
}