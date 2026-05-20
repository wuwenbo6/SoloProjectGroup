using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;

namespace MortiseTenonGame.Education
{
    [System.Serializable]
    public class KnowledgeItem
    {
        public string KnowledgeId;
        public string Title;
        public string Category;
        [TextArea(3, 10)]
        public string Content;
        public Sprite Image;
        public string RelatedLevel;
        public int Difficulty;
    }

    public class KnowledgeManager : Singleton<KnowledgeManager>
    {
        [Header("Knowledge Data")]
        [SerializeField] private List<KnowledgeItem> _knowledgeBase = new List<KnowledgeItem>();
        [SerializeField] private bool _showKnowledgeOnLevelStart = true;

        private KnowledgeItem _currentKnowledge;
        private List<string> _viewedKnowledge = new List<string>();

        public KnowledgeItem CurrentKnowledge => _currentKnowledge;
        public IReadOnlyList<KnowledgeItem> KnowledgeBase => _knowledgeBase.AsReadOnly();
        public bool ShowKnowledgeOnLevelStart => _showKnowledgeOnLevelStart;

        protected override void Awake()
        {
            base.Awake();
            InitializeKnowledgeBase();
        }

        private void InitializeKnowledgeBase()
        {
            if (_knowledgeBase.Count == 0)
            {
                CreateDefaultKnowledge();
            }
        }

        private void CreateDefaultKnowledge()
        {
            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "straight_tenon",
                Title = "直榫 - 榫卯之始",
                Category = "基础榫卯",
                Content = "直榫是最基本的榫卯结构，也是所有榫卯的基础。它由一个凸出的榫头和一个凹进的卯眼组成。\n\n" +
                          "【历史】直榫的使用可以追溯到7000年前的新石器时代，在河姆渡遗址中就发现了使用直榫结构的干栏式建筑。\n\n" +
                          "【特点】结构简单，制作方便，适用于垂直接合。在传统家具和建筑中被广泛使用。\n\n" +
                          "【工艺】榫头的长度通常是木料厚度的1/2到2/3，这样既能保证强度，又不会削弱木料本身。",
                Difficulty = 1,
                RelatedLevel = "1"
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "l_shaped",
                Title = "L型榫 - 角部连接",
                Category = "基础榫卯",
                Content = "L型榫（也称格角榫）用于连接两个呈90度角的木料，常见于家具的框架角部。\n\n" +
                          "【历史】L型榫在春秋战国时期的青铜器和漆器上就有应用，到了汉代已经相当成熟。\n\n" +
                          "【特点】接合面大，强度高，外形美观。能够承受各个方向的拉力和压力。\n\n" +
                          "【应用】常用于桌子、柜子、画框等家具的四角连接，是古典家具中最常见的结构之一。",
                Difficulty = 2,
                RelatedLevel = "2"
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "t_shaped",
                Title = "T型榫 - 十字交叉",
                Category = "进阶榫卯",
                Content = "T型榫（也称插肩榫）用于三个方向的木料连接，形成T字形结构。\n\n" +
                          "【历史】T型榫在唐宋时期得到广泛应用，特别是在建筑梁架和大型家具的制作中。\n\n" +
                          "【特点】结构复杂但稳固，能够同时连接三根木料，形成稳定的三维结构。\n\n" +
                          "【工艺】制作时需要精确计算各部件的尺寸和角度，确保接合严密无缝。",
                Difficulty = 3,
                RelatedLevel = "3"
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "dovetail",
                Title = "燕尾榫 - 锁合之王",
                Category = "高级榫卯",
                Content = "燕尾榫因形状类似燕子的尾巴而得名，是最牢固的榫卯结构之一。\n\n" +
                          "【历史】燕尾榫最早出现在商代的青铜器铸造中，用于连接范模。到了明代，燕尾榫技术达到了顶峰。\n\n" +
                          "【特点】形状独特，一旦接合就无法直接拉开，具有自锁功能。被称为\"万榫之母\"。\n\n" +
                          "【应用】常用于抽屉、箱子等需要强力接合的地方。古代的大船建造也大量使用燕尾榫。",
                Difficulty = 4,
                RelatedLevel = "4"
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "dougong",
                Title = "斗拱 - 建筑之魂",
                Category = "建筑榫卯",
                Content = "斗拱是中国古代建筑中最具代表性的构件，由斗、拱、翘、昂等多个部件组成。\n\n" +
                          "【历史】斗拱最早出现在西周时期，经过春秋战国的发展，到汉代基本定型。唐宋时期达到鼎盛。\n\n" +
                          "【功能】1. 承重：将屋顶的重量传递到柱子上；2. 抗震：斗拱的层层叠叠能够有效缓冲地震波；3. 装饰：精美的斗拱是建筑等级的象征。\n\n" +
                          "【文化】斗拱是中国古代建筑智慧的结晶，体现了\"天人合一\"的建筑理念。故宫的太和殿就使用了上千朵斗拱。",
                Difficulty = 5,
                RelatedLevel = "5"
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "history_overview",
                Title = "榫卯简史",
                Category = "历史文化",
                Content = "【新石器时代】7000年前，河姆渡文化出现了最早的榫卯。\n\n" +
                          "【商周时期】榫卯技术应用于青铜器铸造和木结构建筑。\n\n" +
                          "【春秋战国】榫卯种类增多，工艺日趋精细。《考工记》中记载了多种榫卯结构。\n\n" +
                          "【秦汉时期】榫卯在建筑中大量使用，形成了完整的木构建筑体系。\n\n" +
                          "【唐宋时期】榫卯技术达到高峰，斗拱体系完全成熟。\n\n" +
                          "【明清时期】家具榫卯达到艺术顶峰，出现了硬木家具的黄金时代。\n\n" +
                          "【现代】榫卯作为传统文化符号，在现代设计中焕发新生。",
                Difficulty = 2
            });

            _knowledgeBase.Add(new KnowledgeItem
            {
                KnowledgeId = "philosophy",
                Title = "榫卯的哲学智慧",
                Category = "文化内涵",
                Content = "榫卯不仅是一种工艺，更蕴含着深刻的东方哲学：\n\n" +
                          "【阴阳相生】榫为阳，卯为阴，一凸一凹，相互契合，体现了中国传统的阴阳哲学。\n\n" +
                          "【和而不同】每个构件都有自己的形状和功能，但又相互依存、和谐统一。\n\n" +
                          "【刚柔并济】榫卯结合既有刚性的连接，又有柔性的缓冲，能够承受外力而不折断。\n\n" +
                          "【天人合一】榫卯结构顺应木材的自然特性，不破坏木材的纹理，体现了人与自然的和谐。\n\n" +
                          "【无胜于有】最好的榫卯是看不出榫卯，构件浑然一体，体现了道家\"大巧若拙\"的思想。",
                Difficulty = 3
            });
        }

        public KnowledgeItem GetKnowledge(string knowledgeId)
        {
            return _knowledgeBase.Find(k => k.KnowledgeId == knowledgeId);
        }

        public void ShowKnowledge(string knowledgeId)
        {
            var knowledge = GetKnowledge(knowledgeId);
            if (knowledge != null)
            {
                _currentKnowledge = knowledge;
                if (!_viewedKnowledge.Contains(knowledgeId))
                {
                    _viewedKnowledge.Add(knowledgeId);
                }
            }
        }

        public List<KnowledgeItem> GetKnowledgeByCategory(string category)
        {
            return _knowledgeBase.FindAll(k => k.Category == category);
        }

        public List<KnowledgeItem> GetKnowledgeByDifficulty(int maxDifficulty)
        {
            return _knowledgeBase.FindAll(k => k.Difficulty <= maxDifficulty);
        }

        public bool HasViewedKnowledge(string knowledgeId)
        {
            return _viewedKnowledge.Contains(knowledgeId);
        }

        public int GetViewedCount()
        {
            return _viewedKnowledge.Count;
        }

        public List<string> GetAllCategories()
        {
            List<string> categories = new List<string>();
            foreach (var item in _knowledgeBase)
            {
                if (!categories.Contains(item.Category))
                {
                    categories.Add(item.Category);
                }
            }
            return categories;
        }
    }
}