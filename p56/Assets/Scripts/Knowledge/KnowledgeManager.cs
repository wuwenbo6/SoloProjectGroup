using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Knowledge
{
    public class KnowledgeManager : Singleton<KnowledgeManager>
    {
        [Header("知识库")]
        public List<KnowledgeItem> allKnowledge = new List<KnowledgeItem>();

        private Dictionary<string, KnowledgeItem> knowledgeDictionary = new Dictionary<string, KnowledgeItem>();
        private HashSet<string> unlockedKnowledge = new HashSet<string>();

        protected override void Awake()
        {
            base.Awake();
            InitializeKnowledgeBase();
            LoadUnlockedKnowledge();
        }

        private void InitializeKnowledgeBase()
        {
            knowledgeDictionary.Clear();

            foreach (var item in allKnowledge)
            {
                if (!knowledgeDictionary.ContainsKey(item.id))
                {
                    knowledgeDictionary[item.id] = item;
                }
            }

            if (allKnowledge.Count == 0)
            {
                InitializeDefaultKnowledge();
            }
        }

        private void InitializeDefaultKnowledge()
        {
            AddKnowledgeItem(new KnowledgeItem
            {
                id = "tie_dye_history",
                title = "扎染的历史",
                category = KnowledgeCategory.History,
                content = "扎染是一种古老的纺织品染色工艺，起源于中国，距今已有数千年的历史。早在秦汉时期，人们就开始使用结扎防染的方法来制作带有花纹的织物。到了唐代，扎染技艺达到了很高的水平，出现了多种复杂的扎结方法。\n\n扎染技艺通过丝绸之路传到了日本、印度等地，在不同地区发展出了各自的特色。日本的"绞り"（しぼり）就是在中国扎染基础上发展起来的。\n\n在现代，扎染不仅是一种传统工艺，也成为了一种时尚元素，被广泛应用于服装设计、家居装饰等领域。",
                unlockLevel = 0,
                isUnlocked = true
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "traditional_dyes",
                title = "传统染料",
                category = KnowledgeCategory.Material,
                content = "传统扎染使用天然植物染料，主要包括：\n\n1. 靛蓝：最常用的蓝色染料，从蓝草中提取，颜色深沉持久\n2. 茜草：红色染料，从茜草根中提取\n3. 栀子：黄色染料，使用栀子花的果实\n4. 紫草：紫色染料\n5. 苏木：红色至棕色染料\n\n这些天然染料不仅颜色自然，而且环保无害，对皮肤友好。不同地区根据当地的植物资源发展出了各具特色的染料配方。",
                unlockLevel = 0,
                isUnlocked = true
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "fold_tie_method",
                title = "折叠扎法",
                category = KnowledgeCategory.Technique,
                content = "折叠扎法是最基础的扎染方法之一，适合初学者学习。\n\n操作步骤：\n1. 将布料平放在桌面上\n2. 按照设计好的图案进行折叠，可以是对折、三折或多折\n3. 使用棉线在折叠后的布料上进行捆扎，间距可以均匀也可以有变化\n4. 确保捆扎牢固，防止染料渗透\n5. 进行染色\n\n折叠扎法可以创造出对称的几何图案，常见的有条纹、棋盘格等效果。捆扎的松紧程度会影响最终的图案效果，捆扎越紧，留白区域越明显。",
                unlockLevel = 0,
                isUnlocked = true
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "spiral_tie_method",
                title = "螺旋扎法",
                category = KnowledgeCategory.Technique,
                content = "螺旋扎法可以创造出美丽的彩虹漩涡效果，是最受欢迎的扎染方法之一。\n\n操作步骤：\n1. 将布料平铺，在布料中心用镊子夹住一个点\n2. 以中心点为中心，开始旋转布料，形成螺旋状\n3. 旋转过程中保持布料平整，避免产生褶皱\n4. 当整个布料形成圆盘状后，用棉线从多个方向进行捆扎\n5. 通常使用3-4条线将圆盘分成相等的部分\n\n螺旋扎法可以使用多种颜色，在不同区域添加不同颜色的染料，干燥后会形成美丽的渐变效果。这种方法常用于制作T恤、围巾等服饰。",
                unlockLevel = 2,
                isUnlocked = false
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "circle_tie_method",
                title = "圆形扎法",
                category = KnowledgeCategory.Technique,
                content = "圆形扎法可以创造出同心圆或靶心状的图案效果。\n\n操作步骤：\n1. 在布料上确定要制作圆形的位置\n2. 用镊子夹住中心点，轻轻提起\n3. 用棉线在提起的布料根部进行捆扎\n4. 可以在不同高度进行多次捆扎，形成多层同心圆\n5. 每个捆扎区域可以使用不同的颜色\n\n圆形扎法可以单独使用，也可以组合多个圆形创造更复杂的图案。常见的应用包括制作波点图案、花朵图案等。",
                unlockLevel = 1,
                isUnlocked = false
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "fabric_types",
                title = "布料选择",
                category = KnowledgeCategory.Material,
                content = "扎染的效果与使用的布料材质有密切关系，不同布料的吸色性和纹理会产生不同的效果。\n\n推荐布料：\n1. 棉布：最常用的扎染布料，吸色好，效果稳定\n2. 亚麻：纹理独特，适合制作具有自然质感的作品\n3. 丝绸：光泽度好，染色效果鲜艳，但需要特殊处理\n4. 人造棉：价格实惠，适合练习\n\n布料的织法密度也会影响染色效果，粗织布料会有更明显的纹理效果，细织布料则颜色更均匀。建议初次尝试使用白色或浅色的100%棉布。",
                unlockLevel = 0,
                isUnlocked = true
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "dali_bai",
                title = "大理白族扎染",
                category = KnowledgeCategory.Culture,
                content = "云南大理白族扎染是中国国家级非物质文化遗产，具有鲜明的民族特色和深厚的文化内涵。\n\n白族扎染特点：\n1. 以蓝白两色为主色调，素雅清新\n2. 图案多取材于自然，如花卉、鸟兽、山水\n3. 承载着白族人民的审美情趣和生活理念\n4. 采用板蓝根等天然染料\n\n传统的白族扎染全靠手工制作，每一件作品都独一无二。扎染在白族人民的日常生活中应用广泛，如服饰、头巾、围腰、窗帘等。如今大理周城被誉为"扎染之乡"，这项传统技艺在传承中不断创新发展。",
                unlockLevel = 3,
                isUnlocked = false
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "japan_shibori",
                title = "日本绞缬(Shibori)",
                category = KnowledgeCategory.Culture,
                content = "日本的绞缬（しぼり，Shibori）是在吸收中国扎染技艺基础上发展起来的独特染色工艺。\n\n日本绞缬特点：\n1. 技法极其丰富，有超过100种不同的扎结方法\n2. 最著名的有：鹿子绞（Kanoko）、三浦绞（Miura）、蜘蛛绞（Kumo）等\n3. 强调精细的手工技艺，有些作品需要数月时间完成\n4. 常与和服结合，成为日本传统服饰的重要装饰\n\n日本绞缬不仅是一种工艺，更是一种艺术表达。艺术家们通过不同的扎结方法探索布料与颜色的无限可能性，创造出令人惊叹的艺术作品。",
                unlockLevel = 4,
                isUnlocked = false
            });

            AddKnowledgeItem(new KnowledgeItem
            {
                id = "modern_application",
                title = "现代扎染应用",
                category = KnowledgeCategory.Culture,
                content = "在当代，扎染这项古老的技艺焕发了新的生命力，被广泛应用于各个领域：\n\n时尚领域：\n1. 服装设计：从高端时装到日常休闲装都能看到扎染元素\n2. 服饰配件：围巾、头巾、包袋等\n3. 鞋履设计\n\n家居领域：\n1. 窗帘、床单、抱枕等软装饰\n2. 桌布、餐垫等餐厅用品\n3. 墙饰、挂毯等艺术装饰\n\n艺术领域：\n1. 独立的扎染艺术作品\n2. 与其他艺术形式的结合\n3. 装置艺术中的应用\n\n环保趋势也让天然染料的扎染越来越受欢迎，成为可持续时尚的代表之一。",
                unlockLevel = 5,
                isUnlocked = false
            });

            SaveKnowledgeList();
        }

        private void AddKnowledgeItem(KnowledgeItem item)
        {
            allKnowledge.Add(item);
            knowledgeDictionary[item.id] = item;
        }

        public void UnlockKnowledge(string id)
        {
            if (knowledgeDictionary.ContainsKey(id) && !unlockedKnowledge.Contains(id))
            {
                unlockedKnowledge.Add(id);
                knowledgeDictionary[id].isUnlocked = true;
                SaveUnlockedKnowledge();
            }
        }

        public void UnlockKnowledgeForLevel(int level)
        {
            foreach (var item in allKnowledge)
            {
                if (item.unlockLevel <= level && !item.isUnlocked)
                {
                    UnlockKnowledge(item.id);
                }
            }
        }

        public KnowledgeItem GetKnowledgeById(string id)
        {
            return knowledgeDictionary.ContainsKey(id) ? knowledgeDictionary[id] : null;
        }

        public List<KnowledgeItem> GetKnowledgeByCategory(KnowledgeCategory category)
        {
            return allKnowledge.FindAll(k => k.category == category);
        }

        public List<KnowledgeItem> GetUnlockedKnowledge()
        {
            return allKnowledge.FindAll(k => k.isUnlocked);
        }

        public List<KnowledgeItem> GetLockedKnowledge()
        {
            return allKnowledge.FindAll(k => !k.isUnlocked);
        }

        private void LoadUnlockedKnowledge()
        {
            string json = PlayerPrefs.GetString("UnlockedKnowledge", "");
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    KnowledgeIdListData data = JsonUtility.FromJson<KnowledgeIdListData>(json);
                    foreach (string id in data.ids)
                    {
                        if (knowledgeDictionary.ContainsKey(id))
                        {
                            knowledgeDictionary[id].isUnlocked = true;
                            unlockedKnowledge.Add(id);
                        }
                    }
                }
                catch
                {
                    Debug.Log("Failed to load unlocked knowledge");
                }
            }
        }

        private void SaveUnlockedKnowledge()
        {
            KnowledgeIdListData data = new KnowledgeIdListData
            {
                ids = new List<string>(unlockedKnowledge)
            };
            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString("UnlockedKnowledge", json);
        }

        private void SaveKnowledgeList()
        {
            KnowledgeListData data = new KnowledgeListData
            {
                items = allKnowledge
            };
            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString("KnowledgeBase", json);
        }
    }

    [System.Serializable]
    public class KnowledgeItem
    {
        public string id;
        public string title;
        public KnowledgeCategory category;
        [TextArea(5, 20)]
        public string content;
        public int unlockLevel;
        public bool isUnlocked;
    }

    public enum KnowledgeCategory
    {
        History,
        Technique,
        Material,
        Culture
    }

    [System.Serializable]
    public class KnowledgeIdListData
    {
        public List<string> ids;
    }

    [System.Serializable]
    public class KnowledgeListData
    {
        public List<KnowledgeItem> items;
    }
}
