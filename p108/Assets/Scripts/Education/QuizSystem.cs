using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;
using MortiseTenonGame.Levels;

namespace MortiseTenonGame.Education
{
    [System.Serializable]
    public class QuizQuestion
    {
        public string QuestionId;
        public string Category;
        public int Difficulty;
        public string QuestionText;
        public string[] Options;
        public int CorrectAnswerIndex;
        public string Explanation;
        public string RelatedKnowledgeId;
    }

    [System.Serializable]
    public class QuizCategory
    {
        public string CategoryName;
        public List<QuizQuestion> Questions;
        public int UnlockLevel;
        public bool IsUnlocked;
    }

    public class QuizSystem : Singleton<QuizSystem>
    {
        [Header("Quiz Settings")]
        [SerializeField] private int _questionsPerQuiz = 5;
        [SerializeField] private float _timePerQuestion = 30f;
        [SerializeField] private bool _showExplanation = true;
        [SerializeField] private int _scorePerQuestion = 100;
        [SerializeField] private int _bonusForPerfect = 200;

        [Header("Difficulty Settings")]
        [SerializeField] private int _easyQuestions = 2;
        [SerializeField] private int _mediumQuestions = 2;
        [SerializeField] private int _hardQuestions = 1;

        private List<QuizCategory> _quizCategories = new List<QuizCategory>();
        private List<QuizQuestion> _currentQuestionSet = new List<QuizQuestion>();
        private QuizQuestion _currentQuestion;
        private int _currentQuestionIndex;
        private int _correctAnswers;
        private int _totalScore;
        private float _questionStartTime;
        private bool _isQuizActive;
        private bool _hasAnswered;
        private List<string> _answeredQuestionIds = new List<string>();

        public bool IsQuizActive => _isQuizActive;
        public QuizQuestion CurrentQuestion => _currentQuestion;
        public int CurrentQuestionIndex => _currentQuestionIndex;
        public int TotalQuestions => _currentQuestionSet.Count;
        public int CorrectAnswers => _correctAnswers;
        public int TotalScore => _totalScore;
        public float TimeRemaining => Mathf.Max(0, _timePerQuestion - (Time.time - _questionStartTime));
        public IReadOnlyList<QuizCategory> Categories => _quizCategories.AsReadOnly();

        protected override void Awake()
        {
            base.Awake();
            InitializeQuizDatabase();
        }

        private void Start()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelCompleted += OnLevelCompleted;
            }
        }

        protected override void OnDestroy()
        {
            if (LevelManager.Instance != null)
            {
                LevelManager.Instance.OnLevelCompleted -= OnLevelCompleted;
            }
            base.OnDestroy();
        }

        private void InitializeQuizDatabase()
        {
            _quizCategories.Clear();

            var historyCategory = new QuizCategory
            {
                CategoryName = "历史文化",
                UnlockLevel = 1,
                IsUnlocked = true,
                Questions = new List<QuizQuestion>()
            };

            historyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "hist_001",
                Category = "历史文化",
                Difficulty = 1,
                QuestionText = "榫卯技术最早出现在哪个时期？",
                Options = new string[] { "新石器时代", "商周时期", "秦汉时期", "唐宋时期" },
                CorrectAnswerIndex = 0,
                Explanation = "榫卯技术最早出现在距今约7000年前的新石器时代，河姆渡遗址中发现了大量使用榫卯结构的干栏式建筑。",
                RelatedKnowledgeId = "history_overview"
            });

            historyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "hist_002",
                Category = "历史文化",
                Difficulty = 1,
                QuestionText = "斗拱是中国古代哪类建筑的典型特征？",
                Options = new string[] { "民居", "宫殿庙宇", "园林", "桥梁" },
                CorrectAnswerIndex = 1,
                Explanation = "斗拱是宫殿、庙宇等大型建筑的典型特征，主要作用是承载挑出的屋檐重量，并具有装饰和等级象征意义。",
                RelatedKnowledgeId = "dougong"
            });

            historyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "hist_003",
                Category = "历史文化",
                Difficulty = 2,
                QuestionText = "\"榫\"和\"卯\"分别指什么？",
                Options = new string[] { "凹进部分和凸出部分", "凸出部分和凹进部分", "都是连接部件", "都是孔洞" },
                CorrectAnswerIndex = 1,
                Explanation = "榫指凸出的部分（榫头），卯指凹进的部分（卯眼、卯槽）。榫头插入卯眼，形成稳固的连接。",
                RelatedKnowledgeId = "straight_tenon"
            });

            historyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "hist_004",
                Category = "历史文化",
                Difficulty = 2,
                QuestionText = "应县木塔使用了多少朵斗拱？",
                Options = new string[] { "约100朵", "约300朵", "约500朵", "约1000朵" },
                CorrectAnswerIndex = 2,
                Explanation = "应县木塔共使用了约54种、总计500多朵斗拱，是中国古代斗拱应用的典范之作。",
                RelatedKnowledgeId = "dougong"
            });

            historyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "hist_005",
                Category = "历史文化",
                Difficulty = 3,
                QuestionText = "以下哪部著作最早详细记载了榫卯工艺？",
                Options = new string[] { "《天工开物》", "《考工记》", "《营造法式》", "《木经》" },
                CorrectAnswerIndex = 2,
                Explanation = "北宋李诫编著的《营造法式》是最早详细记载榫卯工艺的官方建筑典籍，对后世影响深远。",
                RelatedKnowledgeId = "history_overview"
            });

            _quizCategories.Add(historyCategory);

            var techCategory = new QuizCategory
            {
                CategoryName = "工艺技术",
                UnlockLevel = 1,
                IsUnlocked = true,
                Questions = new List<QuizQuestion>()
            };

            techCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "tech_001",
                Category = "工艺技术",
                Difficulty = 1,
                QuestionText = "燕尾榫的主要优点是什么？",
                Options = new string[] { "美观", "防拉开", "易制作", "省材料" },
                CorrectAnswerIndex = 1,
                Explanation = "燕尾榫因其形状像燕子尾巴而得名，其最大优点是具有自锁功能，能有效防止横向拉开。",
                RelatedKnowledgeId = "dovetail"
            });

            techCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "tech_002",
                Category = "工艺技术",
                Difficulty = 1,
                QuestionText = "以下哪种榫卯常用于角部连接？",
                Options = new string[] { "直榫", "格角榫", "燕尾榫", "夹头榫" },
                CorrectAnswerIndex = 1,
                Explanation = "格角榫是专门用于90度角部连接的榫卯结构，常见于画框、桌子角等部位。",
                RelatedKnowledgeId = "l_shaped"
            });

            techCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "tech_003",
                Category = "工艺技术",
                Difficulty = 2,
                QuestionText = "传统榫卯制作最常用的木材是？",
                Options = new string[] { "松木", "桦木", "红木", "椴木" },
                CorrectAnswerIndex = 2,
                Explanation = "红木类木材（如紫檀、黄花梨、酸枝）质地坚硬、纹理美观，是传统高档家具榫卯制作的首选材料。",
                RelatedKnowledgeId = "philosophy"
            });

            techCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "tech_004",
                Category = "工艺技术",
                Difficulty = 2,
                QuestionText = "\"万榫之母\"指的是哪种榫卯？",
                Options = new string[] { "直榫", "燕尾榫", "格角榫", "粽角榫" },
                CorrectAnswerIndex = 1,
                Explanation = "燕尾榫因其结构巧妙、应用广泛，被称为\"万榫之母\"，是很多其他榫卯的基础。",
                RelatedKnowledgeId = "dovetail"
            });

            techCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "tech_005",
                Category = "工艺技术",
                Difficulty = 3,
                QuestionText = "斗拱中的\"翘\"和\"昂\"的主要区别是？",
                Options = new string[] { "大小不同", "方向不同", "材质不同", "位置不同" },
                CorrectAnswerIndex = 1,
                Explanation = "翘是横向伸出的构件，昂是斜向伸出的杠杆式构件，两者方向不同，共同承托屋檐。",
                RelatedKnowledgeId = "dougong"
            });

            _quizCategories.Add(techCategory);

            var philosophyCategory = new QuizCategory
            {
                CategoryName = "文化哲学",
                UnlockLevel = 3,
                IsUnlocked = false,
                Questions = new List<QuizQuestion>()
            };

            philosophyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "phi_001",
                Category = "文化哲学",
                Difficulty = 1,
                QuestionText = "榫卯体现了中国传统的什么思想？",
                Options = new string[] { "阴阳相生", "天人合一", "两者都是", "两者都不是" },
                CorrectAnswerIndex = 2,
                Explanation = "榫卯的凸凹对应体现了阴阳相生，而顺应木材天然纹理则体现了天人合一的思想。",
                RelatedKnowledgeId = "philosophy"
            });

            philosophyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "phi_002",
                Category = "文化哲学",
                Difficulty = 2,
                QuestionText = "传统榫卯家具为什么不用钉子？",
                Options = new string[] { "古代没有钉子", "钉子容易生锈", "体现可拆卸理念", "钉子不够牢固" },
                CorrectAnswerIndex = 2,
                Explanation = "传统榫卯家具体现了可拆卸、可修复的理念，一件好的家具可以传承数代，损坏的部件可以更换。",
                RelatedKnowledgeId = "philosophy"
            });

            philosophyCategory.Questions.Add(new QuizQuestion
            {
                QuestionId = "phi_003",
                Category = "文化哲学",
                Difficulty = 3,
                QuestionText = "\"材尽其用\"在榫卯中主要指？",
                Options = new string[] { "用最便宜的材料", "用最多的材料", "合理利用木材特性", "用最名贵的材料" },
                CorrectAnswerIndex = 2,
                Explanation = "\"材尽其用\"是指根据木材的特性合理使用，顺应木纹、因材施工，不破坏木材的天然属性。",
                RelatedKnowledgeId = "philosophy"
            });

            _quizCategories.Add(philosophyCategory);
        }

        public bool StartQuiz(string categoryName = null)
        {
            if (_isQuizActive) return false;

            QuizCategory category = null;
            if (!string.IsNullOrEmpty(categoryName))
            {
                category = _quizCategories.Find(c => c.CategoryName == categoryName);
            }
            else
            {
                var unlockedCategories = _quizCategories.FindAll(c => c.IsUnlocked);
                if (unlockedCategories.Count > 0)
                {
                    category = unlockedCategories[Random.Range(0, unlockedCategories.Count)];
                }
            }

            if (category == null || !category.IsUnlocked)
            {
                Debug.LogWarning($"Category '{categoryName}' not found or locked");
                return false;
            }

            SelectQuestionsForQuiz(category);
            _currentQuestionIndex = 0;
            _correctAnswers = 0;
            _totalScore = 0;
            _isQuizActive = true;

            ShowCurrentQuestion();
            return true;
        }

        private void SelectQuestionsForQuiz(QuizCategory category)
        {
            _currentQuestionSet.Clear();

            var easyQuestions = category.Questions.FindAll(q => q.Difficulty == 1);
            var mediumQuestions = category.Questions.FindAll(q => q.Difficulty == 2);
            var hardQuestions = category.Questions.FindAll(q => q.Difficulty == 3);

            AddRandomQuestions(easyQuestions, _easyQuestions);
            AddRandomQuestions(mediumQuestions, _mediumQuestions);
            AddRandomQuestions(hardQuestions, _hardQuestions);

            while (_currentQuestionSet.Count < _questionsPerQuiz && category.Questions.Count > _currentQuestionSet.Count)
            {
                var available = category.Questions.FindAll(q => !_currentQuestionSet.Contains(q));
                if (available.Count > 0)
                {
                    _currentQuestionSet.Add(available[Random.Range(0, available.Count)]);
                }
                else
                {
                    break;
                }
            }

            ShuffleQuestions();
        }

        private void AddRandomQuestions(List<QuizQuestion> source, int count)
        {
            int added = 0;
            var available = new List<QuizQuestion>(source);

            while (added < count && available.Count > 0)
            {
                int index = Random.Range(0, available.Count);
                _currentQuestionSet.Add(available[index]);
                available.RemoveAt(index);
                added++;
            }
        }

        private void ShuffleQuestions()
        {
            for (int i = 0; i < _currentQuestionSet.Count; i++)
            {
                QuizQuestion temp = _currentQuestionSet[i];
                int randomIndex = Random.Range(i, _currentQuestionSet.Count);
                _currentQuestionSet[i] = _currentQuestionSet[randomIndex];
                _currentQuestionSet[randomIndex] = temp;
            }
        }

        private void ShowCurrentQuestion()
        {
            if (_currentQuestionIndex >= _currentQuestionSet.Count)
            {
                EndQuiz();
                return;
            }

            _currentQuestion = _currentQuestionSet[_currentQuestionIndex];
            _questionStartTime = Time.time;
            _hasAnswered = false;

            UIManager.Instance.ShowQuizQuestion(_currentQuestion);
        }

        public bool SubmitAnswer(int answerIndex)
        {
            if (!_isQuizActive || _hasAnswered || _currentQuestion == null)
                return false;

            _hasAnswered = true;
            bool isCorrect = answerIndex == _currentQuestion.CorrectAnswerIndex;

            if (isCorrect)
            {
                _correctAnswers++;
                _totalScore += _scorePerQuestion;
                _answeredQuestionIds.Add(_currentQuestion.QuestionId);
            }

            if (_showExplanation)
            {
                ShowAnswerExplanation(isCorrect);
            }
            else
            {
                NextQuestion();
            }

            return isCorrect;
        }

        private void ShowAnswerExplanation(bool isCorrect)
        {
            string title = isCorrect ? "回答正确！" : "回答错误";
            string message = $"{_currentQuestion.Explanation}\n\n得分: {(isCorrect ? _scorePerQuestion : 0)}";

            UIManager.Instance.ShowHint(title, message, 3f);
            StartCoroutine(DelayNextQuestion(3f));
        }

        private System.Collections.IEnumerator DelayNextQuestion(float delay)
        {
            yield return new WaitForSeconds(delay);
            NextQuestion();
        }

        public void NextQuestion()
        {
            _currentQuestionIndex++;
            ShowCurrentQuestion();
        }

        public void EndQuiz()
        {
            _isQuizActive = false;

            if (_correctAnswers == _currentQuestionSet.Count)
            {
                _totalScore += _bonusForPerfect;
            }

            ShowQuizResults();
        }

        private void ShowQuizResults()
        {
            string result = $"问答完成！\n\n" +
                          $"正确题数: {_correctAnswers}/{_currentQuestionSet.Count}\n" +
                          $"正确率: {Mathf.RoundToInt((float)_correctAnswers / _currentQuestionSet.Count * 100)}%\n" +
                          $"得分: {_totalScore}";

            if (_correctAnswers == _currentQuestionSet.Count)
            {
                result += $"\n\n完美回答奖励: +{_bonusForPerfect}";
            }

            UIManager.Instance.ShowHint("问答结果", result, 8f);
        }

        public void SkipQuestion()
        {
            if (!_isQuizActive || _hasAnswered) return;

            _hasAnswered = true;
            UIManager.Instance.ShowHint("跳过", $"正确答案是: {_currentQuestion.Options[_currentQuestion.CorrectAnswerIndex]}", 2f);
            StartCoroutine(DelayNextQuestion(2f));
        }

        public void CancelQuiz()
        {
            _isQuizActive = false;
            _currentQuestionSet.Clear();
            _currentQuestion = null;
        }

        public void UnlockCategory(string categoryName)
        {
            var category = _quizCategories.Find(c => c.CategoryName == categoryName);
            if (category != null)
            {
                category.IsUnlocked = true;
            }
        }

        public bool IsCategoryUnlocked(string categoryName)
        {
            var category = _quizCategories.Find(c => c.CategoryName == categoryName);
            return category != null && category.IsUnlocked;
        }

        public List<string> GetUnlockedCategories()
        {
            List<string> unlocked = new List<string>();
            foreach (var category in _quizCategories)
            {
                if (category.IsUnlocked)
                {
                    unlocked.Add(category.CategoryName);
                }
            }
            return unlocked;
        }

        private void OnLevelCompleted()
        {
            int currentLevel = LevelManager.Instance.CurrentLevelIndex + 1;

            foreach (var category in _quizCategories)
            {
                if (!category.IsUnlocked && category.UnlockLevel <= currentLevel)
                {
                    category.IsUnlocked = true;
                    UIManager.Instance.ShowHint(
                        "新内容解锁",
                        $"已解锁问答分类: {category.CategoryName}",
                        5f
                    );
                }
            }
        }

        public int GetTotalAnsweredQuestions()
        {
            return _answeredQuestionIds.Count;
        }

        public bool HasAnsweredQuestion(string questionId)
        {
            return _answeredQuestionIds.Contains(questionId);
        }
    }
}