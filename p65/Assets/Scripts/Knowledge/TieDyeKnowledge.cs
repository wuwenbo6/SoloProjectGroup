using UnityEngine;

namespace TieDyeGame.Knowledge
{
    [CreateAssetMenu(fileName = "TieDyeKnowledge", menuName = "TieDye/Knowledge Item")]
    public class TieDyeKnowledge : ScriptableObject
    {
        public string title;
        [TextArea(5, 20)] public string content;
        public Sprite illustration;
        public int unlockLevel = 1;
        public KnowledgeCategory category;
    }

    public enum KnowledgeCategory
    {
        History,
        Techniques,
        Materials,
        Patterns,
        Tips
    }
}