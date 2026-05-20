using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Core;

namespace TieDyeGame.Save
{
    public class GalleryUI : MonoBehaviour
    {
        [Header("UI元素")]
        public Transform galleryGrid;
        public GameObject galleryItemPrefab;
        public Button backButton;
        public Text emptyGalleryText;

        [Header("详情面板")]
        public GameObject detailPanel;
        public Image artworkImage;
        public Text artworkNameText;
        public Text timestampText;
        public Text fabricText;
        public Text dyesText;
        public Text tieMethodText;
        public Button exportButton;
        public Button deleteButton;
        public Button closeDetailButton;

        private ArtworkData selectedArtwork;

        private void Start()
        {
            InitializeUI();
            PopulateGallery();
        }

        private void InitializeUI()
        {
            if (backButton != null)
                backButton.onClick.AddListener(BackToMenu);

            if (closeDetailButton != null)
                closeDetailButton.onClick.AddListener(CloseDetailPanel);

            if (deleteButton != null)
                deleteButton.onClick.AddListener(DeleteSelectedArtwork);

            if (exportButton != null)
                exportButton.onClick.AddListener(ExportSelectedArtwork);
        }

        private void PopulateGallery()
        {
            if (SaveManager.Instance == null) return;

            foreach (Transform child in galleryGrid)
            {
                Destroy(child.gameObject);
            }

            var artworks = SaveManager.Instance.GetSavedArtworks();

            if (emptyGalleryText != null)
                emptyGalleryText.enabled = artworks.Count == 0;

            foreach (var artwork in artworks)
            {
                CreateGalleryItem(artwork);
            }
        }

        private void CreateGalleryItem(ArtworkData artwork)
        {
            GameObject itemObj = Instantiate(galleryItemPrefab, galleryGrid);

            Text nameText = itemObj.GetComponentInChildren<Text>();
            if (nameText != null)
                nameText.text = artwork.name;

            Image previewImage = itemObj.transform.Find("PreviewImage")?.GetComponent<Image>();
            if (previewImage != null)
            {
                Texture2D texture = SaveManager.Instance.LoadArtworkTexture(artwork);
                if (texture != null)
                {
                    Sprite sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), Vector2.one * 0.5f);
                    previewImage.sprite = sprite;
                    previewImage.preserveAspect = true;
                }
            }

            Button btn = itemObj.GetComponent<Button>();
            if (btn != null)
                btn.onClick.AddListener(() => ShowArtworkDetail(artwork));
        }

        private void ShowArtworkDetail(ArtworkData artwork)
        {
            selectedArtwork = artwork;

            if (detailPanel != null)
                detailPanel.SetActive(true);

            if (artworkNameText != null)
                artworkNameText.text = artwork.name;

            if (timestampText != null)
                timestampText.text = $"创建时间: {artwork.timestamp}";

            if (fabricText != null)
                fabricText.text = $"使用布料: {artwork.usedFabric}";

            if (dyesText != null)
                dyesText.text = $"使用染料: {artwork.usedDyes}";

            if (tieMethodText != null)
                tieMethodText.text = $"捆扎方式: {artwork.usedTieMethod}";

            if (artworkImage != null)
            {
                Texture2D texture = SaveManager.Instance.LoadArtworkTexture(artwork);
                if (texture != null)
                {
                    Sprite sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), Vector2.one * 0.5f);
                    artworkImage.sprite = sprite;
                    artworkImage.preserveAspect = true;
                }
            }
        }

        private void CloseDetailPanel()
        {
            if (detailPanel != null)
                detailPanel.SetActive(false);

            selectedArtwork = null;
        }

        private void DeleteSelectedArtwork()
        {
            if (selectedArtwork == null || SaveManager.Instance == null) return;

            SaveManager.Instance.DeleteArtwork(selectedArtwork);
            CloseDetailPanel();
            PopulateGallery();
        }

        private void ExportSelectedArtwork()
        {
            if (selectedArtwork == null || SaveManager.Instance == null) return;

            string exportPath = System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop);
            SaveManager.Instance.ExportArtwork(selectedArtwork, exportPath);
        }

        private void BackToMenu()
        {
            GameManager.Instance.ReturnToMenu();
            SceneManager.LoadScene("MainMenu");
        }
    }
}
