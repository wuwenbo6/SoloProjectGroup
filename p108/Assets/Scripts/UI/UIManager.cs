using UnityEngine;
using UnityEngine.UI;
using MortiseTenonGame.Core;
using MortiseTenonGame.Levels;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Education;

namespace MortiseTenonGame.UI
{
    public class UIManager : Singleton<UIManager>
    {
        [Header("Main Panels")]
        [SerializeField] private GameObject _mainMenuPanel;
        [SerializeField] private GameObject _gamePanel;
        [SerializeField] private GameObject _pausePanel;
        [SerializeField] private GameObject _levelCompletePanel;
        [SerializeField] private GameObject _educationPanel;
        [SerializeField] private GameObject _hintPanel;
        [SerializeField] private GameObject _quizPanel;

        [Header("UI Elements")]
        [SerializeField] private Text _levelNameText;
        [SerializeField] private Text _connectionProgressText;
        [SerializeField] private Text _timerText;
        [SerializeField] private Image _progressBar;
        [SerializeField] private Button _pauseButton;
        [SerializeField] private Button _hintButton;
        [SerializeField] private Button _resetButton;
        [SerializeField] private Button _rotate90Button;
        [SerializeField] private Button _saveButton;
        [SerializeField] private Button _loadButton;
        [SerializeField] private Button _quizButton;

        [Header("Hint Text")]
        [SerializeField] private Text _hintTitleText;
        [SerializeField] private Text _hintContentText;
        [SerializeField] private float _hintDisplayTime = 5f;

        [Header("Quiz UI")]
        [SerializeField] private Text _quizQuestionText;
        [SerializeField] private Text _quizProgressText;
        [SerializeField] private Text _quizTimerText;
        [SerializeField] private Button[] _quizOptionButtons;
        [SerializeField] private Text[] _quizOptionTexts;
        [SerializeField] private Button _quizSubmitButton;
        [SerializeField] private Button _quizSkipButton;
        [SerializeField] private Button _quizCloseButton;

        [Header("Level Complete")]
        [SerializeField] private Text _scoreText;
        [SerializeField] private Text _timeText;
        [SerializeField] private Text _connectionsText;
        [SerializeField] private Button _nextLevelButton;
        [SerializeField] private Button _replayButton;
        [SerializeField] private Button _menuButton;

        [Header("Controls Info")]
        [SerializeField] private Text _controlsInfoText;

        private float _gameTimer;
        private bool _isTimerRunning;
        private Coroutine _hintCoroutine;
        private Coroutine _quizTimerCoroutine;
        private int _selectedQuizOption = -1;

        protected override void Awake()
        {
            base.Awake();
            SetupButtonListeners();
            UpdateControlsInfo();
        }

        protected override void OnDestroy()
        {
            if (_hintCoroutine != null)
            {
                StopCoroutine(_hintCoroutine);
            }
            base.OnDestroy();
        }

        private void SetupButtonListeners()
        {
            if (_pauseButton != null)
                _pauseButton.onClick.AddListener(OnPauseClicked);
            if (_hintButton != null)
                _hintButton.onClick.AddListener(OnHintClicked);
            if (_resetButton != null)
                _resetButton.onClick.AddListener(OnResetClicked);
            if (_nextLevelButton != null)
                _nextLevelButton.onClick.AddListener(OnNextLevelClicked);
            if (_replayButton != null)
                _replayButton.onClick.AddListener(OnReplayClicked);
            if (_menuButton != null)
                _menuButton.onClick.AddListener(OnMenuClicked);
            if (_rotate90Button != null)
                _rotate90Button.onClick.AddListener(OnRotate90Clicked);
            if (_saveButton != null)
                _saveButton.onClick.AddListener(OnSaveClicked);
            if (_loadButton != null)
                _loadButton.onClick.AddListener(OnLoadClicked);
            if (_quizButton != null)
                _quizButton.onClick.AddListener(OnQuizButtonClicked);
        }

        private void Start()
        {
            ShowMainMenu();
        }

        private void Update()
        {
            if (_isTimerRunning)
            {
                _gameTimer += Time.deltaTime;
                UpdateTimerDisplay();
            }
        }

        private void UpdateControlsInfo()
        {
            if (_controlsInfoText != null)
            {
                _controlsInfoText.text = 
                    "操作说明:\n" +
                    "• 左键拖拽: 移动部件\n" +
                    "• 右键点击: 旋转90°\n" +
                    "• R + X/Y/Z: 绕轴旋转\n" +
                    "• Shift + 操作: 精细调整\n" +
                    "• 鼠标中键: 视角旋转";
            }
        }

        public void ShowMainMenu()
        {
            HideAllPanels();
            _mainMenuPanel?.SetActive(true);
            GameManager.Instance.ChangeState(GameManager.GameState.Menu);
        }

        public void ShowGameUI()
        {
            HideAllPanels();
            _gamePanel?.SetActive(true);
            GameManager.Instance.ChangeState(GameManager.GameState.Playing);
            StartTimer();
            ShowLevelHint();
        }

        private void ShowLevelHint()
        {
            var level = LevelManager.Instance.CurrentLevel;
            if (level != null)
            {
                ShowHint("关卡提示", level.Description, _hintDisplayTime);
            }
        }

        public void ShowHint(string title, string content, float displayTime = 5f)
        {
            if (_hintPanel == null) return;

            if (_hintCoroutine != null)
            {
                StopCoroutine(_hintCoroutine);
            }

            if (_hintTitleText != null)
                _hintTitleText.text = title;
            if (_hintContentText != null)
                _hintContentText.text = content;

            _hintPanel.SetActive(true);
            _hintCoroutine = StartCoroutine(HideHintAfterDelay(displayTime));
        }

        private System.Collections.IEnumerator HideHintAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            _hintPanel?.SetActive(false);
            _hintCoroutine = null;
        }

        public void ShowPauseMenu()
        {
            _pausePanel?.SetActive(true);
            GameManager.Instance.PauseGame();
        }

        public void HidePauseMenu()
        {
            _pausePanel?.SetActive(false);
            GameManager.Instance.ResumeGame();
        }

        public void ShowLevelComplete(int score, float time, int connections)
        {
            HideAllPanels();
            _levelCompletePanel?.SetActive(true);
            GameManager.Instance.CompleteLevel();
            StopTimer();

            if (_scoreText != null)
                _scoreText.text = $"分数: {score}";
            if (_timeText != null)
                _timeText.text = $"用时: {FormatTime(time)}";
            if (_connectionsText != null)
                _connectionsText.text = $"连接数: {connections}";

            ShowHint("恭喜通关！", "你成功完成了本关卡的榫卯搭建！\n点击下一关继续挑战，或点击重玩再次尝试。", 10f);
        }

        public void ShowEducationPanel()
        {
            _educationPanel?.SetActive(true);
        }

        public void HideEducationPanel()
        {
            _educationPanel?.SetActive(false);
        }

        private void HideAllPanels()
        {
            _mainMenuPanel?.SetActive(false);
            _gamePanel?.SetActive(false);
            _pausePanel?.SetActive(false);
            _levelCompletePanel?.SetActive(false);
            _educationPanel?.SetActive(false);
            _hintPanel?.SetActive(false);
            _quizPanel?.SetActive(false);
        }

        public void ShowQuizQuestion(QuizQuestion question)
        {
            if (question == null) return;

            _quizPanel?.SetActive(true);
            _selectedQuizOption = -1;

            if (_quizQuestionText != null)
                _quizQuestionText.text = question.QuestionText;

            if (_quizProgressText != null)
                _quizProgressText.text = $"题目 {QuizSystem.Instance.CurrentQuestionIndex + 1}/{QuizSystem.Instance.TotalQuestions}";

            for (int i = 0; i < _quizOptionTexts.Length && i < question.Options.Length; i++)
            {
                if (_quizOptionTexts[i] != null)
                    _quizOptionTexts[i].text = question.Options[i];

                if (_quizOptionButtons[i] != null)
                {
                    int index = i;
                    _quizOptionButtons[i].onClick.RemoveAllListeners();
                    _quizOptionButtons[i].onClick.AddListener(() => OnQuizOptionSelected(index));
                    _quizOptionButtons[i].interactable = true;
                }
            }

            if (_quizSubmitButton != null)
            {
                _quizSubmitButton.onClick.RemoveAllListeners();
                _quizSubmitButton.onClick.AddListener(OnQuizSubmitClicked);
            }

            if (_quizSkipButton != null)
            {
                _quizSkipButton.onClick.RemoveAllListeners();
                _quizSkipButton.onClick.AddListener(OnQuizSkipClicked);
            }

            if (_quizCloseButton != null)
            {
                _quizCloseButton.onClick.RemoveAllListeners();
                _quizCloseButton.onClick.AddListener(OnQuizCloseClicked);
            }

            StartQuizTimer();
        }

        private void OnQuizOptionSelected(int index)
        {
            _selectedQuizOption = index;

            for (int i = 0; i < _quizOptionButtons.Length; i++)
            {
                if (_quizOptionButtons[i] != null)
                {
                    ColorBlock colors = _quizOptionButtons[i].colors;
                    colors.normalColor = i == index ? Color.yellow : Color.white;
                    _quizOptionButtons[i].colors = colors;
                }
            }
        }

        private void OnQuizSubmitClicked()
        {
            if (_selectedQuizOption >= 0)
            {
                QuizSystem.Instance.SubmitAnswer(_selectedQuizOption);
                _quizPanel?.SetActive(false);
                StopQuizTimer();
            }
            else
            {
                ShowHint("提示", "请先选择一个答案", 2f);
            }
        }

        private void OnQuizSkipClicked()
        {
            QuizSystem.Instance.SkipQuestion();
            _quizPanel?.SetActive(false);
            StopQuizTimer();
        }

        private void OnQuizCloseClicked()
        {
            QuizSystem.Instance.CancelQuiz();
            _quizPanel?.SetActive(false);
            StopQuizTimer();
        }

        private void StartQuizTimer()
        {
            StopQuizTimer();
            _quizTimerCoroutine = StartCoroutine(UpdateQuizTimer());
        }

        private void StopQuizTimer()
        {
            if (_quizTimerCoroutine != null)
            {
                StopCoroutine(_quizTimerCoroutine);
                _quizTimerCoroutine = null;
            }
        }

        private System.Collections.IEnumerator UpdateQuizTimer()
        {
            while (QuizSystem.Instance.IsQuizActive)
            {
                if (_quizTimerText != null)
                {
                    _quizTimerText.text = $"{Mathf.CeilToInt(QuizSystem.Instance.TimeRemaining)}秒";
                }
                yield return null;
            }
        }

        private void OnQuizButtonClicked()
        {
            QuizSystem.Instance.StartQuiz();
        }

        public void UpdateProgress(float progress)
        {
            if (_progressBar != null)
                _progressBar.fillAmount = progress;
            if (_connectionProgressText != null)
                _connectionProgressText.text = $"{(progress * 100):0}%";
        }

        public void UpdateLevelName(string levelName)
        {
            if (_levelNameText != null)
                _levelNameText.text = levelName;
        }

        public void StartTimer()
        {
            _gameTimer = 0f;
            _isTimerRunning = true;
        }

        public void StopTimer()
        {
            _isTimerRunning = false;
        }

        public float GetCurrentTime()
        {
            return _gameTimer;
        }

        private void UpdateTimerDisplay()
        {
            if (_timerText != null)
                _timerText.text = FormatTime(_gameTimer);
        }

        private string FormatTime(float time)
        {
            int minutes = Mathf.FloorToInt(time / 60f);
            int seconds = Mathf.FloorToInt(time % 60f);
            return $"{minutes:00}:{seconds:00}";
        }

        private void OnPauseClicked()
        {
            ShowPauseMenu();
        }

        private void OnHintClicked()
        {
            ShowLevelHint();
        }

        private void OnResetClicked()
        {
            ShowHint("重置关卡", "正在重置当前关卡...", 2f);
            LevelManager.Instance.ResetLevel();
        }

        private void OnNextLevelClicked()
        {
            LevelManager.Instance.NextLevel();
        }

        private void OnReplayClicked()
        {
            ShowHint("重玩关卡", "正在重新加载关卡...", 2f);
            LevelManager.Instance.ResetLevel();
        }

        private void OnMenuClicked()
        {
            ShowMainMenu();
        }

        private void OnRotate90Clicked()
        {
            var selectedPiece = PieceManager.Instance.SelectedPiece;
            if (selectedPiece != null)
            {
                selectedPiece.transform.Rotate(Vector3.up, 90f, Space.World);
                ShowHint("旋转部件", "已将选中部件沿Y轴旋转90°。\n也可以使用右键快速旋转。", 2f);
            }
            else
            {
                ShowHint("提示", "请先点击选择一个部件进行旋转。", 2f);
            }
        }

        private void OnSaveClicked()
        {
            bool success = MortiseTenonGame.SaveSystem.SaveManager.SaveCurrentProgress();
            if (success)
            {
                ShowHint("保存成功", "当前关卡进度已保存。\n你可以随时加载继续游戏。", 3f);
            }
            else
            {
                ShowHint("保存失败", "未能保存进度，请确保当前有正在进行的关卡。", 3f);
            }
        }

        private void OnLoadClicked()
        {
            bool success = MortiseTenonGame.SaveSystem.SaveManager.LoadSavedProgress();
            if (success)
            {
                ShowHint("加载成功", "已成功加载保存的进度。", 3f);
            }
            else
            {
                ShowHint("加载失败", "未能找到保存的进度，或加载过程中出现错误。", 3f);
            }
        }

        public void OnStartGameClicked()
        {
            LevelManager.Instance.StartLevel(0);
            ShowGameUI();
        }

        public void OnResumeClicked()
        {
            HidePauseMenu();
        }

        public void OnQuitClicked()
        {
            Application.Quit();
        }
    }
}