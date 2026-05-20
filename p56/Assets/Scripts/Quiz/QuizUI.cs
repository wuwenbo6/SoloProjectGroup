using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using TieDyeGame.Core;

namespace TieDyeGame.Quiz
{
    public class QuizUI : MonoBehaviour
    {
        [Header("开始界面")]
        public GameObject startPanel;
        public Button startQuizButton;
        public Text descriptionText;

        [Header("答题界面")]
        public GameObject questionPanel;
        public Text questionText;
        public Text questionNumberText;
        public Text timerText;
        public Transform optionsContainer;
        public GameObject optionButtonPrefab;

        [Header("答案反馈")]
        public GameObject feedbackPanel;
        public Text resultText;
        public Text explanationText;
        public Button nextQuestionButton;

        [Header("结果界面")]
        public GameObject resultPanel;
        public Text finalScoreText;
        public Text accuracyText;
        public Text correctCountText;
        public Text starsEarnedText;
        public Button retryButton;
        public Button backToMenuButton;

        [Header("关卡触发")]
        public Button openQuizButton;

        private QuizQuestion currentQuestion;
        private int selectedOption = -1;
        private bool canAnswer = true;

        private void Start()
        {
            InitializeButtons();
            SubscribeToEvents();

            if (startPanel != null)
                startPanel.SetActive(true);
            if (questionPanel != null)
                questionPanel.SetActive(false);
            if (feedbackPanel != null)
                feedbackPanel.SetActive(false);
            if (resultPanel != null)
                resultPanel.SetActive(false);
        }

        private void InitializeButtons()
        {
            if (startQuizButton != null)
                startQuizButton.onClick.AddListener(StartQuiz);

            if (nextQuestionButton != null)
                nextQuestionButton.onClick.AddListener(NextQuestion);

            if (retryButton != null)
                retryButton.onClick.AddListener(RestartQuiz);

            if (backToMenuButton != null)
                backToMenuButton.onClick.AddListener(BackToMenu);

            if (openQuizButton != null)
                openQuizButton.onClick.AddListener(OpenQuizFromGame);
        }

        private void SubscribeToEvents()
        {
            if (QuizManager.Instance != null)
            {
                QuizManager.Instance.OnQuestionStart += OnQuestionStart;
                QuizManager.Instance.OnQuestionAnswered += OnQuestionAnswered;
                QuizManager.Instance.OnQuizComplete += OnQuizComplete;
            }
        }

        private void StartQuiz()
        {
            if (QuizManager.Instance != null)
            {
                QuizManager.Instance.StartQuiz(1);
                if (startPanel != null)
                    startPanel.SetActive(false);
            }
        }

        private void OpenQuizFromGame()
        {
            if (startPanel != null)
                startPanel.SetActive(true);
        }

        private void OnQuestionStart(QuizQuestion question, int currentNum, int totalNum)
        {
            currentQuestion = question;
            canAnswer = true;
            selectedOption = -1;

            if (questionPanel != null)
                questionPanel.SetActive(true);
            if (feedbackPanel != null)
                feedbackPanel.SetActive(false);

            if (questionText != null)
                questionText.text = question.question;

            if (questionNumberText != null)
                questionNumberText.text = $"第 {currentNum} / {totalNum} 题";

            CreateOptionButtons(question);
        }

        private void CreateOptionButtons(QuizQuestion question)
        {
            foreach (Transform child in optionsContainer)
            {
                Destroy(child.gameObject);
            }

            for (int i = 0; i < question.options.Count; i++)
            {
                int optionIndex = i;
                GameObject buttonObj = Instantiate(optionButtonPrefab, optionsContainer);
                Button button = buttonObj.GetComponent<Button>();
                Text optionText = buttonObj.GetComponentInChildren<Text>();

                if (optionText != null)
                    optionText.text = question.options[i];

                if (button != null)
                {
                    button.onClick.AddListener(() => SelectOption(optionIndex));
                }
            }
        }

        private void SelectOption(int optionIndex)
        {
            if (!canAnswer) return;

            selectedOption = optionIndex;
            canAnswer = false;

            if (QuizManager.Instance != null)
            {
                QuizManager.Instance.AnswerQuestion(optionIndex);
            }
        }

        private void OnQuestionAnswered(bool isCorrect, string explanation)
        {
            if (questionPanel != null)
                questionPanel.SetActive(false);
            if (feedbackPanel != null)
                feedbackPanel.SetActive(true);

            if (resultText != null)
            {
                resultText.text = isCorrect ? "✓ 回答正确！" : "✗ 回答错误";
                resultText.color = isCorrect ? Color.green : Color.red;
            }

            if (explanationText != null)
                explanationText.text = explanation;

            HighlightCorrectAndWrongAnswers(isCorrect);
        }

        private void HighlightCorrectAndWrongAnswers(bool userWasCorrect)
        {
            Button[] buttons = optionsContainer.GetComponentsInChildren<Button>();

            for (int i = 0; i < buttons.Length; i++)
            {
                Image buttonImage = buttons[i].GetComponent<Image>();
                if (buttonImage == null) continue;

                if (i == currentQuestion.correctAnswerIndex)
                {
                    buttonImage.color = Color.green;
                }
                else if (i == selectedOption && !userWasCorrect)
                {
                    buttonImage.color = Color.red;
                }
            }
        }

        private void NextQuestion()
        {
            if (QuizManager.Instance != null)
            {
                QuizManager.Instance.NextQuestion();
            }
        }

        private void OnQuizComplete(QuizResult result)
        {
            if (questionPanel != null)
                questionPanel.SetActive(false);
            if (feedbackPanel != null)
                feedbackPanel.SetActive(false);
            if (resultPanel != null)
                resultPanel.SetActive(true);

            if (finalScoreText != null)
                finalScoreText.text = $"最终得分：{result.totalScore}";

            if (correctCountText != null)
                correctCountText.text = $"答对：{result.correctAnswers} / {result.totalQuestions}";

            if (accuracyText != null)
                accuracyText.text = $"正确率：{result.accuracy * 100f:F0}%";

            if (starsEarnedText != null)
            {
                if (result.earnedStars > 0)
                    starsEarnedText.text = $"获得星星奖励：{result.earnedStars} ★";
                else
                    starsEarnedText.text = "继续加油，可以获得星星奖励！";
            }
        }

        private void RestartQuiz()
        {
            if (resultPanel != null)
                resultPanel.SetActive(false);
            if (startPanel != null)
                startPanel.SetActive(true);
        }

        private void BackToMenu()
        {
            Time.timeScale = 1f;
            GameManager.Instance.ChangeState(GameState.MainMenu);
            SceneManager.LoadScene("MainMenu");
        }

        private void Update()
        {
            UpdateTimerDisplay();
        }

        private void UpdateTimerDisplay()
        {
            if (QuizManager.Instance != null && timerText != null && QuizManager.Instance.isQuizActive)
            {
                int timeLeft = Mathf.CeilToInt(QuizManager.Instance.currentQuestionTime);
                timerText.text = $"剩余时间：{timeLeft}s";

                if (timeLeft <= 5)
                {
                    timerText.color = Color.red;
                }
                else
                {
                    timerText.color = Color.white;
                }
            }
        }

        private void OnDestroy()
        {
            if (QuizManager.Instance != null)
            {
                QuizManager.Instance.OnQuestionStart -= OnQuestionStart;
                QuizManager.Instance.OnQuestionAnswered -= OnQuestionAnswered;
                QuizManager.Instance.OnQuizComplete -= OnQuizComplete;
            }
        }
    }
}
