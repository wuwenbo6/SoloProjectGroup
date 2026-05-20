using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Quiz
{
    public class QuizManager : Singleton<QuizManager>
    {
        [Header("题库")]
        public List<QuizQuestion> questionBank = new List<QuizQuestion>();

        [Header("答题设置")]
        public int questionsPerRound = 3;
        public float timePerQuestion = 20f;
        public int scorePerCorrect = 100;

        [Header("奖励设置")]
        public int starRewardForPerfect = 1;
        public int minStarsForReward = 2;

        [Header("游戏状态")]
        public int currentQuestionIndex;
        public int correctAnswers;
        public int totalScore;
        public float currentQuestionTime;
        public bool isQuizActive;

        private List<QuizQuestion> currentRoundQuestions = new List<QuizQuestion>();

        public System.Action<QuizQuestion, int, int> OnQuestionStart;
        public System.Action<bool, string> OnQuestionAnswered;
        public System.Action<QuizResult> OnQuizComplete;

        protected override void Awake()
        {
            base.Awake();
            InitializeQuestionBank();
        }

        private void InitializeQuestionBank()
        {
            if (questionBank.Count == 0)
            {
                AddDefaultQuestions();
            }
        }

        private void AddDefaultQuestions()
        {
            questionBank.Add(new QuizQuestion
            {
                id = 1,
                question = "传统扎染工艺中，「扎」的主要作用是什么？",
                options = new List<string> { "固定布料形状", "防止染料渗透特定区域", "增加布料重量", "便于悬挂染色" },
                correctAnswerIndex = 1,
                difficulty = 1,
                explanation = "扎是扎染的关键步骤，通过捆绑布料，使得被扎区域无法被染料渗透，从而形成留白图案。",
                category = QuizCategory.Craft
            });

            questionBank.Add(new QuizQuestion
            {
                id = 2,
                question = "中国最著名的扎染之乡是哪里？",
                options = new List<string> { "苏州", "大理周城", "杭州", "成都" },
                correctAnswerIndex = 1,
                difficulty = 1,
                explanation = "云南大理周城被誉为「扎染之乡」，白族扎染技艺是国家级非物质文化遗产。",
                category = QuizCategory.History
            });

            questionBank.Add(new QuizQuestion
            {
                id = 3,
                question = "传统扎染最常用的天然染料是什么？",
                options = new List<string> { "红花", "板蓝根", "紫草", "苏木" },
                correctAnswerIndex = 1,
                difficulty = 1,
                explanation = "板蓝根是传统扎染最常用的染料，可以提取出纯正的靛蓝色。",
                category = QuizCategory.Material
            });

            questionBank.Add(new QuizQuestion
            {
                id = 4,
                question = "扎染工艺在中国有多少年的历史？",
                options = new List<string> { "约500年", "约1000年", "约1500年以上", "约50年" },
                correctAnswerIndex = 2,
                difficulty = 2,
                explanation = "扎染工艺起源于秦汉时期，距今已有1500多年的历史，唐代时已相当发达。",
                category = QuizCategory.History
            });

            questionBank.Add(new QuizQuestion
            {
                id = 5,
                question = "日本的扎染工艺被称为什么？",
                options = new List<string> { "友禅", "绞り（Shibori）", "型染", "蓝染" },
                correctAnswerIndex = 1,
                difficulty = 2,
                explanation = "日本的扎染称为「绞り」（Shibori），是在吸收中国扎染技艺后发展出的独特工艺。",
                category = QuizCategory.Culture
            });

            questionBank.Add(new QuizQuestion
            {
                id = 6,
                question = "下列哪种不是常见的扎染捆扎方法？",
                options = new List<string> { "折叠法", "螺旋法", "打结法", "熨烫法" },
                correctAnswerIndex = 3,
                difficulty = 1,
                explanation = "熨烫法不是扎染的捆扎方法，常见的有折叠、螺旋、打结、夹扎等方法。",
                category = QuizCategory.Craft
            });

            questionBank.Add(new QuizQuestion
            {
                id = 7,
                question = "扎染布料染色后，需要进行什么处理来固色？",
                options = new List<string> { "暴晒", "蒸煮或氧化", "冷冻", "打磨" },
                correctAnswerIndex = 1,
                difficulty = 2,
                explanation = "染色后的布料需要经过蒸煮或充分氧化，使染料充分固着在纤维上。",
                category = QuizCategory.Craft
            });

            questionBank.Add(new QuizQuestion
            {
                id = 8,
                question = "白族扎染的图案大多取材于什么？",
                options = new List<string> { "几何图形", "自然风光和动植物", "抽象艺术", "人物肖像" },
                correctAnswerIndex = 1,
                difficulty = 2,
                explanation = "白族扎染图案多取材于自然风光、花鸟鱼虫等，体现了白族人民对自然的热爱。",
                category = QuizCategory.Culture
            });

            questionBank.Add(new QuizQuestion
            {
                id = 9,
                question = "扎染的「染」步骤中，多次浸染的目的是什么？",
                options = new List<string> { "节省染料", "加深颜色和层次感", "加快速度", "便于晾干" },
                correctAnswerIndex = 1,
                difficulty = 1,
                explanation = "多次浸染可以让颜色更深沉，并产生丰富的层次感和渐变效果。",
                category = QuizCategory.Craft
            });

            questionBank.Add(new QuizQuestion
            {
                id = 10,
                question = "现代扎染与传统扎染相比，最大的区别是？",
                options = new List<string> { "完全不同", "使用化学染料，传统用天然染料", "更简单", "图案变小" },
                correctAnswerIndex = 1,
                difficulty = 2,
                explanation = "现代扎染更多使用化学染料，色彩更丰富但缺少天然染料的独特质感和环保特性。",
                category = QuizCategory.Material
            });
        }

        public void StartQuiz(int difficulty = 1)
        {
            currentRoundQuestions.Clear();
            currentQuestionIndex = 0;
            correctAnswers = 0;
            totalScore = 0;
            isQuizActive = true;

            SelectQuestionsForRound(difficulty);

            if (currentRoundQuestions.Count > 0)
            {
                StartQuestion(0);
            }
        }

        private void SelectQuestionsForRound(int difficulty)
        {
            List<QuizQuestion> availableQuestions = questionBank.FindAll(q => q.difficulty <= difficulty + 1);

            while (currentRoundQuestions.Count < questionsPerRound && availableQuestions.Count > 0)
            {
                int randomIndex = Random.Range(0, availableQuestions.Count);
                currentRoundQuestions.Add(availableQuestions[randomIndex]);
                availableQuestions.RemoveAt(randomIndex);
            }
        }

        private void StartQuestion(int index)
        {
            if (index >= currentRoundQuestions.Count)
            {
                EndQuiz();
                return;
            }

            currentQuestionIndex = index;
            currentQuestionTime = timePerQuestion;
            OnQuestionStart?.Invoke(currentRoundQuestions[index], index + 1, currentRoundQuestions.Count);
        }

        public void AnswerQuestion(int answerIndex)
        {
            if (!isQuizActive || currentQuestionIndex >= currentRoundQuestions.Count) return;

            QuizQuestion question = currentRoundQuestions[currentQuestionIndex];
            bool isCorrect = answerIndex == question.correctAnswerIndex;

            if (isCorrect)
            {
                correctAnswers++;
                int timeBonus = Mathf.RoundToInt(currentQuestionTime / timePerQuestion * 50f);
                totalScore += scorePerCorrect + timeBonus;
            }

            OnQuestionAnswered?.Invoke(isCorrect, question.explanation);
        }

        public void NextQuestion()
        {
            StartQuestion(currentQuestionIndex + 1);
        }

        private void EndQuiz()
        {
            isQuizActive = false;

            QuizResult result = new QuizResult
            {
                totalQuestions = currentRoundQuestions.Count,
                correctAnswers = correctAnswers,
                totalScore = totalScore,
                accuracy = (float)correctAnswers / currentRoundQuestions.Count,
                earnedStars = CalculateStarsEarned()
            };

            OnQuizComplete?.Invoke(result);
        }

        private int CalculateStarsEarned()
        {
            if (correctAnswers == currentRoundQuestions.Count)
                return starRewardForPerfect;
            else if (correctAnswers >= minStarsForReward)
                return 1;
            return 0;
        }

        public void Update()
        {
            if (isQuizActive)
            {
                currentQuestionTime -= Time.deltaTime;
                if (currentQuestionTime <= 0)
                {
                    AnswerQuestion(-1);
                }
            }
        }
    }

    [System.Serializable]
    public class QuizQuestion
    {
        public int id;
        public string question;
        public List<string> options;
        public int correctAnswerIndex;
        public int difficulty;
        public string explanation;
        public QuizCategory category;
    }

    public class QuizResult
    {
        public int totalQuestions;
        public int correctAnswers;
        public float accuracy;
        public int totalScore;
        public int earnedStars;
    }

    public enum QuizCategory
    {
        History,
        Craft,
        Material,
        Culture
    }
}
