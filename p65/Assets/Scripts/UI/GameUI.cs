using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TieDyeGame.Core;
using TieDyeGame.Materials;
using TieDyeGame.Level;

namespace TieDyeGame.UI
{
    public class GameUI : MonoBehaviour
    {
        [Header("Core References")]
        [SerializeField] private TieDyeSimulation tieDyeSimulation;
        [SerializeField] private MeshRenderer fabricRenderer;
        
        [Header("UI Panels")]
        [SerializeField] private GameObject gamePanel;
        [SerializeField] private GameObject pausePanel;
        [SerializeField] private GameObject completePanel;
        [SerializeField] private GameObject failPanel;
        [SerializeField] private GameObject knowledgePopup;
        
        [Header("Level Info")]
        [SerializeField] private TMPro.TMP_Text levelNameText;
        [SerializeField] private TMPro.TMP_Text timerText;
        [SerializeField] private TMPro.TMP_Text dyeCountText;
        
        [Header("Craft Tips")]
        [SerializeField] private TMPro.TMP_Text craftTipText;
        [SerializeField] private GameObject craftTipPanel;
        [SerializeField] private float tipDisplayDuration = 4f;
        
        [Header("Color Selection")]
        [SerializeField] private Transform colorContainer;
        [SerializeField] private GameObject colorButtonPrefab;
        
        [Header("Pattern Selection")]
        [SerializeField] private Transform patternContainer;
        [SerializeField] private GameObject patternButtonPrefab;
        
        [Header("Fabric Selection")]
        [SerializeField] private Transform fabricContainer;
        [SerializeField] private GameObject fabricButtonPrefab;
        
        [Header("Brush Settings")]
        [SerializeField] private Slider brushSizeSlider;
        [SerializeField] private Slider brushIntensitySlider;
        [SerializeField] private TMPro.TMP_Text brushSizeLabel;
        [SerializeField] private TMPro.TMP_Text brushIntensityLabel;
        
        [Header("Result")]
        [SerializeField] private TMPro.TMP_Text scoreText;
        [SerializeField] private TMPro.TMP_Text similarityText;
        [SerializeField] private Image[] starImages;
        [SerializeField] private Sprite filledStarSprite;
        [SerializeField] private Sprite emptyStarSprite;
        
        private Color _selectedColor = Color.red;
        private float _brushSize = 0.1f;
        private float _brushIntensity = 1f;
        private Texture2D _fabricTexture;
        private float _tipTimer;
        private TiePattern _currentPattern;

        private static class CraftTips
        {
            public const string Welcome = "欢迎学习传统扎染工艺！选择捆扎图案后开始染色。";
            public const string SelectPattern = "已选择{0}图案。该图案通过{1}实现防染效果。";
            public const string SelectColor = "已选择{0}。提示：{1}";
            public const string ApplyDye = "正在染色！染料会在布料上缓慢扩散，模拟真实的毛细渗透效果。";
            public const string StartSimulation = "开始固色模拟！观察颜色如何通过织物纤维自然渗透。";
            public const string StopSimulation = "已停止模拟，可继续染色或提交作品。";
            public const string ResetCanvas = "画布已重置。记得先选择捆扎图案再染色！";
            public const string SubmitResult = "正在评估作品...相似度越高，得分越高！";
            public const string LowDyeRemaining = "注意：剩余染色次数不足，请谨慎操作！";
            public const string TimeWarning = "时间紧迫！请尽快完成作品。";
            public const string SpiralInfo = "螺旋扎法：从中心旋转捆扎，染色后形成美丽的螺旋纹理，是最经典的扎染图案之一。";
            public const string BullseyeInfo = "靶心扎法：使用线绳将布料多点捆绑，形成同心圆图案，类似靶心效果。";
            public const string StripesInfo = "条纹扎法：将布料折叠后捆绑，可形成水平、垂直或斜向条纹。";
            public const string FoldingInfo = "折叠扎法：通过不同的折叠方式产生几何图案，适合制作规则花纹。";
            public const string ColorRed = "红色：在传统扎染中常用茜草或红花染色，象征吉祥与喜庆。";
            public const string ColorBlue = "蓝色：使用靛蓝染料，是最古老的扎染颜色，象征沉稳与纯净。";
            public const string ColorYellow = "黄色：可用栀子或槐花染色，象征尊贵与希望。";
            public const string ColorGreen = "绿色：黄蓝混色而成，象征生机与自然。";
            public const string ColorMagenta = "紫红色：苏木或紫草染色，象征典雅与神秘。";
            public const string ColorCyan = "青色：蓝草与蓼蓝混染，象征清新与宁静。";
            public const string BrushSize = "画笔大小：控制单次染色的范围。较大的画笔适合大面积铺色。";
            public const string BrushIntensity = "染色强度：控制染料浓度。高强度适合图案边缘，低强度适合渐变效果。";
            public const string FabricCotton = "棉布料：吸水性好，染色均匀，是最常用的扎染面料。";
            public const string FabricSilk = "丝绸：光泽度高，染色鲜艳，适合制作高档工艺品。";
            public const string FabricLinen = "亚麻：纹理独特，染色后呈现自然质朴的效果。";
        }

        private void Start()
        {
            InitializeGame();
            SetupEventListeners();
            ShowCraftTip(CraftTips.Welcome);
        }

        private void InitializeGame()
        {
            ShowGamePanel();
            
            var selectedLevel = PlayerPrefs.GetInt("SelectedLevel", 1);
            if (selectedLevel > 0 && LevelManager.Instance != null)
            {
                LevelManager.Instance.StartLevel(selectedLevel);
                levelNameText.text = LevelManager.Instance.currentLevel?.levelName ?? "Level";
                InitializeColors(LevelManager.Instance.currentLevel?.availableColors ?? GetDefaultColors());
                InitializePatterns(LevelManager.Instance.currentLevel?.availablePatterns ?? new TiePattern[0]);
                InitializeFabrics(LevelManager.Instance.currentLevel?.availableFabrics ?? new FabricMaterial[0]);
            }
            else
            {
                levelNameText.text = "Free Mode";
                InitializeDefaultColors();
                InitializeDefaultPatterns();
                InitializeDefaultFabrics();
            }
            
            InitializeTexture();
            UpdateBrushLabels();
        }

        private Color[] GetDefaultColors()
        {
            return new Color[] { Color.red, Color.blue, Color.yellow, Color.green, Color.magenta, Color.cyan };
        }

        private void InitializeTexture()
        {
            _fabricTexture = tieDyeSimulation.GetRenderTexture();
            fabricRenderer.material.mainTexture = _fabricTexture;
        }

        private void SetupEventListeners()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnTimeUpdated += UpdateTimer;
                LevelManager.Instance.OnTimeUpdated += CheckTimeWarning;
                LevelManager.Instance.OnLevelCompleted += ShowCompletePanel;
                LevelManager.Instance.OnLevelFailed += ShowFailPanel;
            }
        }

        private void CheckTimeWarning()
        {
            if (LevelManager.Instance != null && LevelManager.Instance.currentTime < 30 && LevelManager.Instance.currentTime > 29)
            {
                ShowCraftTip(CraftTips.TimeWarning);
            }
        }

        private void Update()
        {
            HandleInput();
            UpdateUI();
            UpdateTipTimer();
        }

        private void HandleInput()
        {
            if (Input.GetMouseButtonDown(0) && !IsPointerOverUI())
            {
                ShowCraftTip(CraftTips.ApplyDye);
            }
            
            if (Input.GetMouseButton(0) && !IsPointerOverUI())
            {
                ApplyDye();
            }
            
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                TogglePause();
            }
        }

        private bool IsPointerOverUI()
        {
            return UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject();
        }

        private void ApplyDye()
        {
            if (LevelManager.Instance != null && !LevelManager.Instance.CanApplyDye())
            {
                return;
            }
            
            var ray = Camera.main.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out var hit))
            {
                var uv = hit.textureCoord;
                tieDyeSimulation.ApplyDye(uv, _selectedColor, _brushSize, _brushIntensity);
                
                LevelManager.Instance?.IncrementDyeApplications();
                UpdateDyeCount();
                CheckDyeCountWarning();
            }
        }

        private void CheckDyeCountWarning()
        {
            if (LevelManager.Instance?.currentLevel == null) return;
            
            var remaining = LevelManager.Instance.currentLevel.maxDyeApplications - LevelManager.Instance.dyeApplicationsUsed;
            if (remaining == 3)
            {
                ShowCraftTip(CraftTips.LowDyeRemaining);
            }
        }

        private void UpdateUI()
        {
            if (_fabricTexture != tieDyeSimulation.GetRenderTexture())
            {
                _fabricTexture = tieDyeSimulation.GetRenderTexture();
                fabricRenderer.material.mainTexture = _fabricTexture;
            }
        }

        private void UpdateTimer()
        {
            if (LevelManager.Instance == null) return;
            
            var time = LevelManager.Instance.currentTime;
            var minutes = Mathf.FloorToInt(time / 60);
            var seconds = Mathf.FloorToInt(time % 60);
            timerText.text = $"{minutes:00}:{seconds:00}";
            
            timerText.color = time < 30 ? Color.red : Color.white;
        }

        private void UpdateDyeCount()
        {
            if (LevelManager.Instance?.currentLevel == null) return;
            
            var used = LevelManager.Instance.dyeApplicationsUsed;
            var max = LevelManager.Instance.currentLevel.maxDyeApplications;
            dyeCountText.text = $"{used}/{max}";
        }

        private void UpdateBrushLabels()
        {
            if (brushSizeLabel != null)
                brushSizeLabel.text = $"画笔大小: {_brushSize:P0}";
            
            if (brushIntensityLabel != null)
                brushIntensityLabel.text = $"染色强度: {_brushIntensity:P0}";
        }

        private void UpdateTipTimer()
        {
            if (_tipTimer > 0)
            {
                _tipTimer -= Time.deltaTime;
                if (_tipTimer <= 0)
                {
                    craftTipPanel?.SetActive(false);
                }
            }
        }

        private void ShowCraftTip(string message)
        {
            if (craftTipText != null)
            {
                craftTipText.text = message;
                craftTipPanel?.SetActive(true);
                _tipTimer = tipDisplayDuration;
            }
        }

        private void InitializeColors(Color[] colors)
        {
            foreach (Transform child in colorContainer)
            {
                Destroy(child.gameObject);
            }
            
            foreach (var color in colors)
            {
                var button = Instantiate(colorButtonPrefab, colorContainer).GetComponent<Button>();
                var image = button.GetComponent<Image>();
                image.color = color;
                button.onClick.AddListener(() => SelectColor(color));
            }
        }

        private void InitializeDefaultColors()
        {
            InitializeColors(GetDefaultColors());
        }

        private void InitializePatterns(TiePattern[] patterns)
        {
            foreach (Transform child in patternContainer)
            {
                Destroy(child.gameObject);
            }
            
            foreach (var pattern in patterns)
            {
                var button = Instantiate(patternButtonPrefab, patternContainer).GetComponent<Button>();
                var text = button.GetComponentInChildren<TMPro.TMP_Text>();
                text.text = pattern.patternName;
                button.onClick.AddListener(() => SelectPattern(pattern));
            }
        }

        private void InitializeDefaultPatterns()
        {
            var button = Instantiate(patternButtonPrefab, patternContainer).GetComponent<Button>();
            var text = button.GetComponentInChildren<TMPro.TMP_Text>();
            text.text = "无图案";
        }

        private void InitializeFabrics(FabricMaterial[] fabrics)
        {
            foreach (Transform child in fabricContainer)
            {
                Destroy(child.gameObject);
            }
            
            foreach (var fabric in fabrics)
            {
                var button = Instantiate(fabricButtonPrefab, fabricContainer).GetComponent<Button>();
                var text = button.GetComponentInChildren<TMPro.TMP_Text>();
                text.text = fabric.fabricName;
                var image = button.GetComponent<Image>();
                image.color = fabric.baseColor;
            }
        }

        private void InitializeDefaultFabrics()
        {
            var button = Instantiate(fabricButtonPrefab, fabricContainer).GetComponent<Button>();
            var text = button.GetComponentInChildren<TMPro.TMP_Text>();
            text.text = "白棉布";
        }

        public void SelectColor(Color color)
        {
            _selectedColor = color;
            
            var colorName = GetColorName(color);
            var colorInfo = GetColorInfo(color);
            ShowCraftTip(string.Format(CraftTips.SelectColor, colorName, colorInfo));
        }

        private string GetColorName(Color color)
        {
            if (color == Color.red) return "红色";
            if (color == Color.blue) return "蓝色";
            if (color == Color.yellow) return "黄色";
            if (color == Color.green) return "绿色";
            if (color == Color.magenta) return "紫红色";
            if (color == Color.cyan) return "青色";
            return "自定义色";
        }

        private string GetColorInfo(Color color)
        {
            if (color == Color.red) return CraftTips.ColorRed;
            if (color == Color.blue) return CraftTips.ColorBlue;
            if (color == Color.yellow) return CraftTips.ColorYellow;
            if (color == Color.green) return CraftTips.ColorGreen;
            if (color == Color.magenta) return CraftTips.ColorMagenta;
            if (color == Color.cyan) return CraftTips.ColorCyan;
            return "这是一种美丽的颜色。";
        }

        public void SelectPattern(TiePattern pattern)
        {
            _currentPattern = pattern;
            tieDyeSimulation.ApplyTiePattern(pattern);
            
            var patternInfo = GetPatternInfo(pattern.patternName);
            ShowCraftTip(string.Format(CraftTips.SelectPattern, pattern.patternName, patternInfo));
        }

        private string GetPatternInfo(string patternName)
        {
            if (patternName.Contains("螺旋") || patternName.ToLower().Contains("spiral"))
                return "将布料从中心旋转收紧，用线绳固定多个点。染色后，未被捆绑的区域会呈现螺旋状纹理";
            if (patternName.Contains("靶心") || patternName.ToLower().Contains("bullseye"))
                return "在布料上选择多个点，用线绳紧紧捆绑。捆绑处无法染色，形成圆形留白图案";
            if (patternName.Contains("条纹") || patternName.ToLower().Contains("stripe"))
                return "将布料折叠成条状后捆绑。染色后展开，形成平行或交叉的条纹效果";
            if (patternName.Contains("折叠") || patternName.ToLower().Contains("fold"))
                return "通过不同的折叠方式（如手风琴、三角形等），配合捆扎产生几何图案";
            return "这是一种独特的扎染技法。";
        }

        public void OnBrushSizeChanged()
        {
            _brushSize = brushSizeSlider.value;
            UpdateBrushLabels();
            
            if (_tipTimer <= 0.1f)
            {
                ShowCraftTip(CraftTips.BrushSize);
            }
        }

        public void OnBrushIntensityChanged()
        {
            _brushIntensity = brushIntensitySlider.value;
            UpdateBrushLabels();
            
            if (_tipTimer <= 0.1f)
            {
                ShowCraftTip(CraftTips.BrushIntensity);
            }
        }

        public void StartSimulation()
        {
            tieDyeSimulation.StartSimulation();
            ShowCraftTip(CraftTips.StartSimulation);
        }

        public void StopSimulation()
        {
            tieDyeSimulation.StopSimulation();
            ShowCraftTip(CraftTips.StopSimulation);
        }

        public void ResetCanvas()
        {
            tieDyeSimulation.ResetSimulation();
            _currentPattern = null;
            ShowCraftTip(CraftTips.ResetCanvas);
        }

        public void SubmitResult()
        {
            tieDyeSimulation.StopSimulation();
            ShowCraftTip(CraftTips.SubmitResult);
            
            if (LevelManager.Instance?.currentLevel?.targetPattern != null)
            {
                var similarity = LevelManager.Instance.CalculateSimilarity(
                    tieDyeSimulation.GetColorGrid(),
                    LevelManager.Instance.currentLevel.targetPattern
                );
                
                if (similarity >= LevelManager.Instance.currentLevel.requiredSimilarity)
                {
                    Invoke(nameof(DelayedComplete), 0.5f);
                }
                else
                {
                    Invoke(nameof(DelayedFail), 0.5f);
                }
            }
            else
            {
                Invoke(nameof(ShowCompletePanel), 0.5f);
            }
        }

        private void DelayedComplete()
        {
            LevelManager.Instance.CompleteLevel(
                LevelManager.Instance.CalculateSimilarity(
                    tieDyeSimulation.GetColorGrid(),
                    LevelManager.Instance.currentLevel.targetPattern
                )
            );
        }

        private void DelayedFail()
        {
            LevelManager.Instance.FailLevel("图案不匹配");
        }

        private void ShowGamePanel()
        {
            gamePanel.SetActive(true);
            pausePanel.SetActive(false);
            completePanel.SetActive(false);
            failPanel.SetActive(false);
        }

        public void TogglePause()
        {
            if (pausePanel.activeSelf)
            {
                ResumeGame();
            }
            else
            {
                PauseGame();
            }
        }

        private void PauseGame()
        {
            LevelManager.Instance?.PauseLevel();
            gamePanel.SetActive(false);
            pausePanel.SetActive(true);
            Time.timeScale = 0;
        }

        private void ResumeGame()
        {
            LevelManager.Instance?.ResumeLevel();
            gamePanel.SetActive(true);
            pausePanel.SetActive(false);
            Time.timeScale = 1;
        }

        private void ShowCompletePanel()
        {
            gamePanel.SetActive(false);
            completePanel.SetActive(true);
            
            if (LevelManager.Instance?.currentLevel != null && Save.LevelSaveData.Instance != null)
            {
                var progress = Save.LevelSaveData.Instance.GetLevelProgress(LevelManager.Instance.currentLevel.levelId);
                if (progress != null)
                {
                    scoreText.text = $"得分: {progress.bestScore}";
                    similarityText.text = $"相似度: {progress.bestSimilarity:P0}";
                    
                    for (var i = 0; i < starImages.Length; i++)
                    {
                        starImages[i].sprite = i < progress.stars ? filledStarSprite : emptyStarSprite;
                    }
                }
            }
        }

        private void ShowFailPanel()
        {
            gamePanel.SetActive(false);
            failPanel.SetActive(true);
        }

        public void ShowKnowledge()
        {
            knowledgePopup.SetActive(true);
        }

        public void HideKnowledge()
        {
            knowledgePopup.SetActive(false);
        }

        public void RestartLevel()
        {
            LevelManager.Instance?.RestartLevel();
            tieDyeSimulation.ResetSimulation();
            _currentPattern = null;
            ShowGamePanel();
            Time.timeScale = 1;
            ShowCraftTip(CraftTips.Welcome);
        }

        public void ReturnToMenu()
        {
            Time.timeScale = 1;
            SceneManager.LoadScene("MainMenu");
        }

        public void NextLevel()
        {
            if (LevelManager.Instance?.currentLevel == null) return;
            
            var nextLevelId = LevelManager.Instance.currentLevel.levelId + 1;
            if (LevelManager.Instance.IsLevelUnlocked(nextLevelId))
            {
                PlayerPrefs.SetInt("SelectedLevel", nextLevelId);
                SceneManager.LoadScene("GameScene");
            }
            else
            {
                ReturnToMenu();
            }
        }

        private void OnDestroy()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnTimeUpdated -= UpdateTimer;
                LevelManager.Instance.OnTimeUpdated -= CheckTimeWarning;
                LevelManager.Instance.OnLevelCompleted -= ShowCompletePanel;
                LevelManager.Instance.OnLevelFailed -= ShowFailPanel;
            }
        }
    }
}