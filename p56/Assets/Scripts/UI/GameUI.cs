using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Core;
using TieDyeGame.DyePhysics;
using TieDyeGame.Materials;
using TieDyeGame.Levels;
using TieDyeGame.Save;
using TieDyeGame.Scoring;

namespace TieDyeGame.UI
{
    public class GameUI : MonoBehaviour
    {
        [Header("布料和染色")]
        public FabricMesh fabricMesh;
        public DyeSimulation dyeSimulation;
        public Camera gameCamera;

        [Header("顶部信息栏")]
        public Text levelNameText;
        public Text timerText;
        public Text scoreText;
        public Button pauseButton;

        [Header("布料选择")]
        public GameObject fabricPanel;
        public Transform fabricGrid;
        public GameObject fabricItemPrefab;
        public Button openFabricPanelButton;
        public Button closeFabricPanelButton;

        [Header("染料选择")]
        public GameObject dyePanel;
        public Transform dyeGrid;
        public GameObject dyeItemPrefab;
        public Button openDyePanelButton;
        public Button closeDyePanelButton;
        public Slider brushSizeSlider;
        public Text brushSizeText;
        public Slider concentrationSlider;
        public Text concentrationText;

        [Header("捆扎方式")]
        public GameObject tiePanel;
        public Transform tieGrid;
        public GameObject tieItemPrefab;
        public Button openTiePanelButton;
        public Button closeTiePanelButton;
        public Button applyTieButton;

        [Header("操作按钮")]
        public Button startSimulationButton;
        public Button stopSimulationButton;
        public Button resetButton;
        public Button saveButton;
        public Button completeButton;

        [Header("暂停面板")]
        public GameObject pausePanel;
        public Button resumeButton;
        public Button restartButton;
        public Button menuButton;

        [Header("完成面板")]
        public GameObject completePanel;
        public Text finalScoreText;
        public Text starsEarnedText;
        public Button nextLevelButton;
        public Button retryButton;
        public Button completeMenuButton;

        [Header("评分面板")]
        public Text gradeText;
        public Text colorVarietyScoreText;
        public Text patternIntegrityScoreText;
        public Text craftsmanshipScoreText;
        public Text diffusionBeautyScoreText;
        public Text feedbackText;

        [Header("提示面板")]
        public GameObject tipPanel;
        public Text tipText;
        public Button closeTipButton;

        [Header("消息提示")]
        public GameObject messagePanel;
        public Text messageText;
        public float messageDisplayTime = 2f;

        private float brushSize = 0.1f;
        private float dyeConcentration = 1f;
        private bool isDragging = false;
        private bool hasAppliedTie = false;
        private bool hasAppliedDye = false;
        private bool hasSimulatedDiffusion = false;
        private float totalSimulationTime = 0f;

        [Header("输入优化")]
        public int inputSmoothingFrames = 3;
        public float minimumDragDistance = 0.005f;

        private Vector2 lastInputPos;
        private Vector2 smoothedInputPos;
        private List<Vector2> inputHistory = new List<Vector2>();
        private bool wasHittingFabric = false;

        private void Start()
        {
            InitializeUI();
            SetupFabric();
            SubscribeEvents();
            ShowTutorialTip();
        }

        private void InitializeUI()
        {
            if (pauseButton != null)
                pauseButton.onClick.AddListener(PauseGame);

            if (openFabricPanelButton != null)
                openFabricPanelButton.onClick.AddListener(() => fabricPanel.SetActive(true));
            if (closeFabricPanelButton != null)
                closeFabricPanelButton.onClick.AddListener(() => fabricPanel.SetActive(false));

            if (openDyePanelButton != null)
                openDyePanelButton.onClick.AddListener(() => dyePanel.SetActive(true));
            if (closeDyePanelButton != null)
                closeDyePanelButton.onClick.AddListener(() => dyePanel.SetActive(false));

            if (openTiePanelButton != null)
                openTiePanelButton.onClick.AddListener(() => tiePanel.SetActive(true));
            if (closeTiePanelButton != null)
                closeTiePanelButton.onClick.AddListener(() => tiePanel.SetActive(false));
            if (applyTieButton != null)
                applyTieButton.onClick.AddListener(ApplyTieMethod);

            if (startSimulationButton != null)
                startSimulationButton.onClick.AddListener(StartDiffusion);
            if (stopSimulationButton != null)
                stopSimulationButton.onClick.AddListener(StopDiffusion);
            if (resetButton != null)
                resetButton.onClick.AddListener(ResetFabric);
            if (saveButton != null)
                saveButton.onClick.AddListener(SaveArtwork);
            if (completeButton != null)
                completeButton.onClick.AddListener(CompleteLevel);

            if (resumeButton != null)
                resumeButton.onClick.AddListener(ResumeGame);
            if (restartButton != null)
                restartButton.onClick.AddListener(RestartLevel);
            if (menuButton != null)
                menuButton.onClick.AddListener(BackToMenu);

            if (nextLevelButton != null)
                nextLevelButton.onClick.AddListener(NextLevel);
            if (retryButton != null)
                retryButton.onClick.AddListener(RestartLevel);
            if (completeMenuButton != null)
                completeMenuButton.onClick.AddListener(BackToMenu);

            if (closeTipButton != null)
                closeTipButton.onClick.AddListener(() => tipPanel.SetActive(false));

            if (brushSizeSlider != null)
            {
                brushSizeSlider.onValueChanged.AddListener(OnBrushSizeChanged);
                OnBrushSizeChanged(brushSizeSlider.value);
            }

            if (concentrationSlider != null)
            {
                concentrationSlider.onValueChanged.AddListener(OnConcentrationChanged);
                OnConcentrationChanged(concentrationSlider.value);
            }

            PopulateMaterials();
            UpdateLevelInfo();
        }

        private void ShowTutorialTip()
        {
            string tip = "欢迎来到扎染工艺！\n\n" +
                         "操作步骤：\n" +
                         "1. 选择捆扎方式（重要！决定图案效果）\n" +
                         "2. 选择染料颜色\n" +
                         "3. 在布料上点击/拖拽进行染色\n" +
                         "4. 点击「开始扩散」观察染料渗透\n" +
                         "5. 满意后点击「完成作品」\n\n" +
                         "提示：先捆扎再染色，捆扎区域会留白形成美丽图案！";
            ShowTip(tip);
        }

        private void SetupFabric()
        {
            if (fabricMesh != null && dyeSimulation != null)
            {
                fabricMesh.SetDyeSimulation(dyeSimulation);
            }
        }

        private void SubscribeEvents()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelCompleted += OnLevelCompleted;
                LevelManager.Instance.OnLevelFailed += OnLevelFailed;
            }

            if (SaveManager.Instance != null)
            {
                SaveManager.Instance.OnArtworkSaved += OnArtworkSaved;
                SaveManager.Instance.OnSaveFailed += OnSaveFailed;
            }
        }

        private void OnArtworkSaved(Save.ArtworkData artwork)
        {
            ShowMessage($"作品「{artwork.name}」保存成功！");
        }

        private void OnSaveFailed(string error)
        {
            ShowMessage($"保存失败: {error}");
        }

        private void OnDestroy()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelCompleted -= OnLevelCompleted;
                LevelManager.Instance.OnLevelFailed -= OnLevelFailed;
            }

            if (SaveManager.Instance != null)
            {
                SaveManager.Instance.OnArtworkSaved -= OnArtworkSaved;
                SaveManager.Instance.OnSaveFailed -= OnSaveFailed;
            }
        }

        private void PopulateMaterials()
        {
            PopulateFabrics();
            PopulateDyes();
            PopulateTieMethods();
        }

        private void PopulateFabrics()
        {
            if (MaterialManager.Instance == null || fabricGrid == null) return;

            foreach (Transform child in fabricGrid)
                Destroy(child.gameObject);

            var fabrics = MaterialManager.Instance.GetUnlockedFabrics(0);
            foreach (var fabric in fabrics)
            {
                GameObject item = Instantiate(fabricItemPrefab, fabricGrid);
                Image colorImg = item.GetComponentInChildren<Image>();
                if (colorImg != null)
                    colorImg.color = fabric.baseColor;

                Text nameText = item.GetComponentInChildren<Text>();
                if (nameText != null)
                    nameText.text = fabric.fabricName;

                Button btn = item.GetComponent<Button>();
                if (btn != null)
                    btn.onClick.AddListener(() => SelectFabric(fabric));
            }
        }

        private void PopulateDyes()
        {
            if (MaterialManager.Instance == null || dyeGrid == null) return;

            foreach (Transform child in dyeGrid)
                Destroy(child.gameObject);

            var dyes = MaterialManager.Instance.GetUnlockedDyes(0);
            foreach (var dye in dyes)
            {
                GameObject item = Instantiate(dyeItemPrefab, dyeGrid);
                Image colorImg = item.GetComponentInChildren<Image>();
                if (colorImg != null)
                    colorImg.color = dye.color;

                Text nameText = item.GetComponentInChildren<Text>();
                if (nameText != null)
                    nameText.text = dye.dyeName;

                Button btn = item.GetComponent<Button>();
                if (btn != null)
                    btn.onClick.AddListener(() => SelectDye(dye));
            }
        }

        private void PopulateTieMethods()
        {
            if (MaterialManager.Instance == null || tieGrid == null) return;

            foreach (Transform child in tieGrid)
                Destroy(child.gameObject);

            var methods = MaterialManager.Instance.GetUnlockedTieMethods(0);
            foreach (var method in methods)
            {
                GameObject item = Instantiate(tieItemPrefab, tieGrid);
                Text nameText = item.GetComponentInChildren<Text>();
                if (nameText != null)
                    nameText.text = method.methodName;

                Button btn = item.GetComponent<Button>();
                if (btn != null)
                    btn.onClick.AddListener(() => SelectTieMethod(method));
            }
        }

        private void SelectFabric(FabricData fabric)
        {
            MaterialManager.Instance.SelectFabric(fabric);
            fabricPanel.SetActive(false);
        }

        private void SelectDye(DyeColor dye)
        {
            MaterialManager.Instance.SelectDye(dye);
        }

        private void SelectTieMethod(TieMethod method)
        {
            MaterialManager.Instance.SelectTieMethod(method);
        }

        private void ApplyTieMethod()
        {
            if (MaterialManager.Instance == null || MaterialManager.Instance.selectedTieMethod == null)
            {
                ShowMessage("请先选择一种捆扎方式！");
                return;
            }

            var tieMethod = MaterialManager.Instance.selectedTieMethod;
            var points = tieMethod.GeneratePatternPoints(1);
            dyeSimulation.ClearBlockedRegions();
            dyeSimulation.SetBlockedRegion(points, tieMethod.blockRadius);
            tiePanel.SetActive(false);
            hasAppliedTie = true;
            ShowMessage($"已应用「{tieMethod.methodName}」！被捆扎的区域会在染色时留白。");
        }

        private void OnBrushSizeChanged(float value)
        {
            brushSize = value;
            if (brushSizeText != null)
                brushSizeText.text = $"笔刷大小: {brushSize:F2}";
        }

        private void OnConcentrationChanged(float value)
        {
            dyeConcentration = value;
            if (concentrationText != null)
            {
                string concentrationDesc = "";
                if (dyeConcentration < 0.4f)
                    concentrationDesc = "淡染";
                else if (dyeConcentration < 0.7f)
                    concentrationDesc = "适中";
                else
                    concentrationDesc = "浓染";
                concentrationText.text = $"染料浓度: {dyeConcentration:F2} ({concentrationDesc})";
            }
        }

        private void UpdateLevelInfo()
        {
            if (LevelManager.Instance != null && LevelManager.Instance.currentLevel != null)
            {
                if (levelNameText != null)
                    levelNameText.text = LevelManager.Instance.currentLevel.levelName;

                ShowTip(LevelManager.Instance.currentLevel.levelTip);
            }
        }

        public void ShowTip(string tip)
        {
            if (!string.IsNullOrEmpty(tip) && tipPanel != null && tipText != null)
            {
                tipText.text = tip;
                tipPanel.SetActive(true);
            }
        }

        public void ShowMessage(string message)
        {
            if (messagePanel != null && messageText != null)
            {
                messageText.text = message;
                messagePanel.SetActive(true);
                CancelInvoke(nameof(HideMessage));
                Invoke(nameof(HideMessage), messageDisplayTime);
            }
        }

        private void HideMessage()
        {
            if (messagePanel != null)
            {
                messagePanel.SetActive(false);
            }
        }

        private void StartDiffusion()
        {
            if (dyeSimulation != null)
            {
                dyeSimulation.StartSimulation();
                hasSimulatedDiffusion = true;
                ShowMessage("染料开始扩散...");
            }
        }

        private void StopDiffusion()
        {
            if (dyeSimulation != null)
            {
                dyeSimulation.StopSimulation();
                ShowMessage("扩散已停止");
            }
        }

        private void ResetFabric()
        {
            if (dyeSimulation != null)
            {
                dyeSimulation.ResetSimulation();
                hasAppliedTie = false;
                hasAppliedDye = false;
                hasSimulatedDiffusion = false;
                totalSimulationTime = 0f;
                ShowMessage("布料已重置！");
            }
        }

        private void SaveArtwork()
        {
            if (SaveManager.Instance != null && dyeSimulation != null)
            {
                Texture2D texture = dyeSimulation.GetResultTexture();
                bool success = SaveManager.Instance.SaveArtwork(texture);
                if (success)
                {
                    ShowMessage("作品已保存到画廊！");
                }
                else
                {
                    ShowMessage("保存失败，请重试！");
                }
            }
        }

        private void CompleteLevel()
        {
            if (!hasAppliedTie)
            {
                ShowMessage("提示：请先应用捆扎方式，否则作品没有扎染图案！");
                tipPanel.SetActive(true);
                tipText.text = "工艺提示：\n\n传统扎染的精髓在于「扎」与「染」的结合。捆扎是创造图案的关键步骤，被捆扎的区域会保持白色，与染色区域形成美丽图案！\n\n请点击「捆扎方式」选择并应用一种扎法后再完成作品。";
                return;
            }

            if (!hasAppliedDye)
            {
                ShowMessage("提示：你还没有给布料染色哦！");
                return;
            }

            if (dyeSimulation != null && ArtworkScorer.Instance != null)
            {
                var result = ArtworkScorer.Instance.EvaluateArtwork(
                    dyeSimulation.GetResultTexture(),
                    hasAppliedTie,
                    hasSimulatedDiffusion,
                    totalSimulationTime
                );
                DisplayScoringResult(result);
            }

            if (LevelManager.Instance != null)
                LevelManager.Instance.CompleteLevel();
        }

        private void DisplayScoringResult(Scoring.ScoringResult result)
        {
            if (gradeText != null)
                gradeText.text = $"评级：{result.grade}";

            if (colorVarietyScoreText != null)
                colorVarietyScoreText.text = $"色彩丰富度：{result.colorVarietyScore}";

            if (patternIntegrityScoreText != null)
                patternIntegrityScoreText.text = $"图案完整度：{result.patternIntegrityScore}";

            if (craftsmanshipScoreText != null)
                craftsmanshipScoreText.text = $"工艺完成度：{result.craftsmanshipScore}";

            if (diffusionBeautyScoreText != null)
                diffusionBeautyScoreText.text = $"晕染美观度：{result.diffusionBeautyScore}";

            if (feedbackText != null)
                feedbackText.text = result.feedback;
        }

        private void PauseGame()
        {
            GameManager.Instance.PauseGame();
            if (pausePanel != null)
                pausePanel.SetActive(true);
        }

        private void ResumeGame()
        {
            GameManager.Instance.ResumeGame();
            if (pausePanel != null)
                pausePanel.SetActive(false);
        }

        private void RestartLevel()
        {
            Time.timeScale = 1f;
            if (LevelManager.Instance != null)
                LevelManager.Instance.RestartLevel();
        }

        private void BackToMenu()
        {
            Time.timeScale = 1f;
            GameManager.Instance.ReturnToMenu();
        }

        private void NextLevel()
        {
            Time.timeScale = 1f;
            if (LevelManager.Instance != null)
            {
                int nextIndex = LevelManager.Instance.currentLevelIndex + 1;
                if (nextIndex < LevelManager.Instance.allLevels.Count)
                {
                    LevelManager.Instance.StartLevel(nextIndex);
                }
                else
                {
                    BackToMenu();
                }
            }
        }

        private void OnLevelCompleted(LevelData level, int score, int stars)
        {
            if (completePanel != null)
                completePanel.SetActive(true);

            if (finalScoreText != null)
                finalScoreText.text = $"最终得分: {score}";

            if (starsEarnedText != null)
                starsEarnedText.text = $"获得星星: {stars}";
        }

        private void OnLevelFailed()
        {
            if (completePanel != null)
                completePanel.SetActive(true);

            if (finalScoreText != null)
                finalScoreText.text = "时间耗尽！";

            if (starsEarnedText != null)
                starsEarnedText.text = "请重新挑战";
        }

        private void Update()
        {
            HandleInput();
            UpdateTimerDisplay();
            TrackSimulationTime();
        }

        private void TrackSimulationTime()
        {
            if (dyeSimulation != null && dyeSimulation.IsSimulating)
            {
                totalSimulationTime += Time.deltaTime;
            }
        }

        private void HandleInput()
        {
            if (GameManager.Instance.currentState != GameState.LevelPlaying) return;

            Ray ray = gameCamera.ScreenPointToRay(Input.mousePosition);
            RaycastHit hit;
            bool isHittingFabric = Physics.Raycast(ray, out hit);

            UpdateCursorVisuals(isHittingFabric);

            if (Input.GetMouseButtonDown(0))
            {
                isDragging = true;
                if (isHittingFabric)
                {
                    Vector2 uv = fabricMesh.GetUVFromWorldPosition(hit.point);
                    ResetInputSmoothing(uv);
                    ApplyDyeAtPosition(uv);
                }
            }
            else if (Input.GetMouseButton(0) && isDragging && isHittingFabric)
            {
                Vector2 uv = fabricMesh.GetUVFromWorldPosition(hit.point);
                SmoothAndApplyDye(uv);
            }
            else if (Input.GetMouseButtonUp(0))
            {
                isDragging = false;
                inputHistory.Clear();
            }

            wasHittingFabric = isHittingFabric;
        }

        private void UpdateCursorVisuals(bool isHitting)
        {
            if (isHitting && !wasHittingFabric)
            {
                Cursor.SetCursor(null, Vector2.zero, CursorMode.Auto);
            }
        }

        private void ResetInputSmoothing(Vector2 initialPos)
        {
            inputHistory.Clear();
            inputHistory.Add(initialPos);
            smoothedInputPos = initialPos;
            lastInputPos = initialPos;
        }

        private void SmoothAndApplyDye(Vector2 rawPos)
        {
            inputHistory.Add(rawPos);
            if (inputHistory.Count > inputSmoothingFrames)
            {
                inputHistory.RemoveAt(0);
            }

            Vector2 smoothedPos = Vector2.zero;
            foreach (Vector2 pos in inputHistory)
            {
                smoothedPos += pos;
            }
            smoothedPos /= inputHistory.Count;
            smoothedInputPos = smoothedPos;

            float distance = Vector2.Distance(lastInputPos, smoothedPos);
            if (distance >= minimumDragDistance)
            {
                int steps = Mathf.Max(1, Mathf.FloorToInt(distance / minimumDragDistance));
                for (int i = 1; i <= steps; i++)
                {
                    float t = (float)i / steps;
                    Vector2 interpolatedPos = Vector2.Lerp(lastInputPos, smoothedPos, t);
                    ApplyDyeAtPosition(interpolatedPos);
                }
                lastInputPos = smoothedPos;
            }
        }

        private void ApplyDyeAtPosition(Vector2 uvPos)
        {
            if (dyeSimulation == null || MaterialManager.Instance.selectedDye == null)
            {
                if (MaterialManager.Instance.selectedDye == null && isDragging)
                {
                    ShowMessage("请先选择染料颜色！");
                }
                return;
            }

            uvPos.x = Mathf.Clamp01(uvPos.x);
            uvPos.y = Mathf.Clamp01(uvPos.y);

            dyeSimulation.ApplyDye(uvPos, MaterialManager.Instance.selectedDye.color, brushSize, 0.7f, dyeConcentration);
            hasAppliedDye = true;
        }

        private void UpdateTimerDisplay()
        {
            if (LevelManager.Instance != null && timerText != null)
            {
                int seconds = Mathf.CeilToInt(LevelManager.Instance.currentTime);
                timerText.text = $"{seconds / 60:D2}:{seconds % 60:D2}";
            }

            if (LevelManager.Instance != null && scoreText != null)
            {
                scoreText.text = $"分数: {LevelManager.Instance.currentScore}";
            }
        }

        private void OnDestroy()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelCompleted -= OnLevelCompleted;
                LevelManager.Instance.OnLevelFailed -= OnLevelFailed;
            }
        }
    }
}
