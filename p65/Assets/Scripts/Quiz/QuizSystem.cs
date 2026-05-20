using System;
using System.Collections.Generic;
using UnityEngine;

namespace TieDyeGame.Quiz
{
    [Serializable]
    public class QuizQuestion
    {
        public int id;
        public string question;
        public string[] options;
        public int correctOptionIndex;
        public string explanation;
        public QuizDifficulty difficulty;
        public QuizCategory category;
        public int unlockRewardId;
        public UnlockRewardType rewardType;
    }

    public enum QuizDifficulty
    {
        Easy,
        Medium,
        Hard
    }

    public enum QuizCategory
    {
        History,
        Technique,
        Material,
        Pattern,
        Culture
    }

    public enum UnlockRewardType
    {
        Color,
        Fabric,
        Pattern,
        Coins,
        Exp
    }

    [Serializable]
    public class UnlockReward
    {
        public int id;
        public string name;
        public UnlockRewardType type;
        public Color color;
        public Material fabricMaterial;
        public Sprite preview;
        public string description;
    }

    public class QuizSystem : MonoBehaviour
    {
        public static QuizSystem Instance { get; private set; }

        [Header("Question Database")]
        public List<QuizQuestion> allQuestions = new List<QuizQuestion>();

        [Header("Rewards")]
        public List<UnlockReward> allRewards = new List<UnlockReward>();

        [Header("Settings")]
        public int questionsPerSession = 5;
        public int easyExpReward = 10;
        public int mediumExpReward = 25;
        public int hardExpReward = 50;
        public int coinsPerCorrect = 50;

        [Header("State")]
        public List<int> answeredQuestionIds = new List<int>();
        public List<int> unlockedRewardIds = new List<int>();

        private List<QuizQuestion> _currentSessionQuestions;
        private int _currentQuestionIndex;
        private int _correctCount;

        public event Action<QuizQuestion> OnQuestionChanged;
        public event Action<bool, string> OnQuestionAnswered;
        public event Action<int, int> OnQuizCompleted;
        public event Action<UnlockReward> OnRewardUnlocked;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeDefaultQuestions();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeDefaultQuestions()
        {
            if (allQuestions.Count > 0) return;

            allQuestions.Add(new QuizQuestion
            {
                id = 1,
                question = "扎染是哪种传统工艺的名称？",
                options = new[] { "织物染色工艺", "陶瓷烧制工艺", "木材雕刻工艺", "纸张制作工艺" },
                correctOptionIndex = 0,
                explanation = "扎染是一种古老的织物染色工艺，通过捆扎、缝合等方式使染料无法渗透到部分区域，形成独特的花纹。",
                difficulty = QuizDifficulty.Easy,
                category = QuizCategory.History
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 2,
                question = "扎染起源于哪个国家？",
                options = new[] { "日本", "中国", "印度", "埃及" },
                correctOptionIndex = 1,
                explanation = "扎染工艺最早起源于中国，已有数千年的历史，后传播到世界各地。",
                difficulty = QuizDifficulty.Easy,
                category = QuizCategory.History
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 3,
                question = "在扎染过程中，捆扎的主要目的是什么？",
                options = new[] { "使布料更整齐", "防止染料渗透到捆扎区域", "加快染色速度", "使布料更柔软" },
                correctOptionIndex = 1,
                explanation = "捆扎的目的是形成防染区，这些区域不会被染料着色，从而在布料上形成独特的图案。",
                difficulty = QuizDifficulty.Easy,
                category = QuizCategory.Technique
            });

            allQuestions.Add(new QuizQuestion
                {
                id = 4,
                question = "以下哪种是最经典的扎染图案？",
                options = new[] { "螺旋纹", "格子纹", "条纹", "圆点" },
                correctOptionIndex = 0,
                explanation = "螺旋纹是扎染中最经典、最具代表性的图案，通过旋转捆扎布料形成。",
                difficulty = QuizDifficulty.Easy,
                category = QuizCategory.Pattern
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 5,
                question = "传统扎染最常用的染料是什么？",
                options = new[] { "化学染料", "植物染料", "矿物染料", "动物染料" },
                correctOptionIndex = 1,
                explanation = "传统扎染主要使用植物染料，如靛蓝、茜草、红花等，色彩自然且环保。",
                difficulty = QuizDifficulty.Easy,
                category = QuizCategory.Material
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 6,
                question = "扎染在日本被称为什么？",
                options = new[] { "友禅染", "绞り染め", "型染", "蜡染" },
                correctOptionIndex = 1,
                explanation = "扎染在日本被称为「绞り染め」（しぼりぞめ），发展出了独特的技法和风格。",
                difficulty = QuizDifficulty.Medium,
                category = QuizCategory.Culture
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 7,
                question = "以下哪种布料最适合做扎染？",
                options = new[] { "丝绸", "尼龙", "纯棉", "涤纶" },
                correctOptionIndex = 2,
                explanation = "纯棉布料吸水性好，着色均匀，是最适合扎染的材料。",
                difficulty = QuizDifficulty.Medium,
                category = QuizCategory.Material,
                rewardType = UnlockRewardType.Fabric,
                unlockRewardId = 1
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 8,
                question = "制作靶心图案（bullseye）应该使用哪种捆扎方法？",
                options = new[] { "折叠法", "点状捆绑法", "螺旋法", "条纹法" },
                correctOptionIndex = 1,
                explanation = "靶心图案通过在布料上选择多个点进行捆绑，形成同心圆的效果。",
                difficulty = QuizDifficulty.Medium,
                category = QuizCategory.Technique
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 9,
                question = "靛蓝染料主要从哪种植物中提取？",
                options = new[] { "红花", "茜草", "蓝草", "紫草" },
                correctOptionIndex = 2,
                explanation = "靛蓝染料主要从蓝草（如马蓝、木蓝等）中提取，是最古老的天然染料之一。",
                difficulty = QuizDifficulty.Medium,
                category = QuizCategory.Material,
                rewardType = UnlockRewardType.Color,
                unlockRewardId = 2
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 10,
                question = "扎染后的布料为什么需要固色处理？",
                options = new[] { "增加光泽", "防止褪色", "使布料更硬", "增加重量" },
                correctOptionIndex = 1,
                explanation = "固色处理可以让染料分子更好地附着在纤维上，防止水洗时褪色，延长作品的使用寿命。",
                difficulty = QuizDifficulty.Medium,
                category = QuizCategory.Technique
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 11,
                question = "中国哪个少数民族的扎染工艺最为著名？",
                options = new[] { "藏族", "白族", "蒙古族", "维吾尔族" },
                correctOptionIndex = 1,
                explanation = "云南大理的白族扎染工艺最为著名，被列入国家级非物质文化遗产。",
                difficulty = QuizDifficulty.Hard,
                category = QuizCategory.Culture
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 12,
                question = "以下哪种不是扎染的传统技法？",
                options = new[] { "捆扎", "缝合", "夹染", "泼墨" },
                correctOptionIndex = 3,
                explanation = "泼墨是国画技法，不是传统扎染技法。扎染主要使用捆扎、缝合、夹染等方式形成防染区。",
                difficulty = QuizDifficulty.Hard,
                category = QuizCategory.Technique
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 13,
                question = "扎染作品的边缘模糊效果是由什么原因造成的？",
                options = new[] { "染色时间太长", "染料的毛细渗透作用", "捆扎太松", "水太多" },
                correctOptionIndex = 1,
                explanation = "染料在布料纤维中的毛细渗透作用使颜色自然扩散，形成独特的模糊边缘效果，这正是扎染的魅力所在。",
                difficulty = QuizDifficulty.Hard,
                category = QuizCategory.Technique
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 14,
                question = "制作丝绸扎染时，最需要注意的是什么？",
                options = new[] { "染色时间", "水温控制", "捆扎力度", "染料浓度" },
                correctOptionIndex = 2,
                explanation = "丝绸纤维娇嫩，捆扎时力度要适中，过紧会留下永久性折痕，过松则图案不清晰。",
                difficulty = QuizDifficulty.Hard,
                category = QuizCategory.Material,
                rewardType = UnlockRewardType.Fabric,
                unlockRewardId = 3
            });

            allQuestions.Add(new QuizQuestion
            {
                id = 15,
                question = "传统扎染中，以下哪种颜色最难获得且最珍贵？",
                options = new[] { "红色", "蓝色", "黄色", "紫色" },
                correctOptionIndex = 3,
                explanation = "紫色染料在古代最为珍贵，需要从紫草等珍稀植物中提取，且提取工艺复杂。在西方历史上，紫色也是皇室专用色。",
                difficulty = QuizDifficulty.Hard,
                category = QuizCategory.Material,
                rewardType = UnlockRewardType.Color,
                unlockRewardId = 4
            });
        }

        public void StartQuiz(QuizDifficulty? difficulty = null)
        {
            _currentSessionQuestions = SelectQuestions(difficulty);
            _currentQuestionIndex = 0;
            _correctCount = 0;
            
            OnQuestionChanged?.Invoke(_currentSessionQuestions[0]);
        }

        private List<QuizQuestion> SelectQuestions(QuizDifficulty? difficulty)
        {
            var availableQuestions = difficulty.HasValue 
                ? allQuestions.FindAll(q => q.difficulty == difficulty.Value && !answeredQuestionIds.Contains(q.id))
                : allQuestions.FindAll(q => !answeredQuestionIds.Contains(q.id));

            if (availableQuestions.Count < questionsPerSession)
            {
                answeredQuestionIds.Clear();
                availableQuestions = difficulty.HasValue 
                    ? allQuestions.FindAll(q => q.difficulty == difficulty.Value)
                    : new List<QuizQuestion>(allQuestions);
            }

            ShuffleList(availableQuestions);
            return availableQuestions.GetRange(0, Math.Min(questionsPerSession, availableQuestions.Count));
        }

        private void ShuffleList<T>(List<T> list)
        {
            var rng = new System.Random();
            var n = list.Count;
            while (n > 1)
            {
                n--;
                var k = rng.Next(n + 1);
                (list[k], list[n]) = (list[n], list[k]);
            }
        }

        public void AnswerQuestion(int optionIndex)
        {
            if (_currentSessionQuestions == null || _currentQuestionIndex >= _currentSessionQuestions.Count)
                return;

            var question = _currentSessionQuestions[_currentQuestionIndex];
            var isCorrect = optionIndex == question.correctOptionIndex;

            if (isCorrect)
            {
                _correctCount++;
                answeredQuestionIds.Add(question.id);
                
                if (question.unlockRewardId > 0 && !unlockedRewardIds.Contains(question.unlockRewardId))
                {
                    var reward = allRewards.Find(r => r.id == question.unlockRewardId);
                    if (reward != null)
                    {
                        unlockedRewardIds.Add(question.unlockRewardId);
                        OnRewardUnlocked?.Invoke(reward);
                    }
                }
            }

            OnQuestionAnswered?.Invoke(isCorrect, question.explanation);
        }

        public void NextQuestion()
        {
            _currentQuestionIndex++;
            
            if (_currentQuestionIndex >= _currentSessionQuestions.Count)
            {
                OnQuizCompleted?.Invoke(_correctCount, _currentSessionQuestions.Count);
            }
            else
            {
                OnQuestionChanged?.Invoke(_currentSessionQuestions[_currentQuestionIndex]);
            }
        }

        public int GetCurrentQuestionNumber()
        {
            return _currentQuestionIndex + 1;
        }

        public int GetTotalQuestions()
        {
            return _currentSessionQuestions?.Count ?? 0;
        }

        public QuizQuestion GetCurrentQuestion()
        {
            return _currentSessionQuestions != null && _currentQuestionIndex < _currentSessionQuestions.Count
                ? _currentSessionQuestions[_currentQuestionIndex]
                : null;
        }

        public bool IsRewardUnlocked(int rewardId)
        {
            return unlockedRewardIds.Contains(rewardId);
        }

        public List<UnlockReward> GetUnlockedRewards()
        {
            return allRewards.FindAll(r => unlockedRewardIds.Contains(r.id));
        }

        public List<UnlockReward> GetLockedRewards()
        {
            return allRewards.FindAll(r => !unlockedRewardIds.Contains(r.id));
        }

        public int CalculateExpReward()
        {
            var totalExp = 0;
            foreach (var question in _currentSessionQuestions.GetRange(0, _correctCount))
            {
                totalExp += question.difficulty switch
                {
                    QuizDifficulty.Easy => easyExpReward,
                    QuizDifficulty.Medium => mediumExpReward,
                    QuizDifficulty.Hard => hardExpReward,
                    _ => 0
                };
            }
            return totalExp;
        }

        public int CalculateCoinReward()
        {
            return _correctCount * coinsPerCorrect;
        }

        public string GetDifficultyName(QuizDifficulty difficulty)
        {
            return difficulty switch
            {
                QuizDifficulty.Easy => "简单",
                QuizDifficulty.Medium => "中等",
                QuizDifficulty.Hard => "困难",
                _ => ""
            };
        }

        public string GetCategoryName(QuizCategory category)
        {
            return category switch
            {
                QuizCategory.History => "历史",
                QuizCategory.Technique => "技法",
                QuizCategory.Material => "材料",
                QuizCategory.Pattern => "图案",
                QuizCategory.Culture => "文化",
                _ => ""
            };
        }
    }
}