using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "NewDye", menuName = "TieDye/DyeColor")]
    public class DyeColor : ScriptableObject
    {
        [Header("染料基本信息")]
        public string dyeName;
        public Color color;
        [TextArea]
        public string culturalMeaning;

        [Header("染料属性")]
        public float diffusionStrength = 1f;
        public float stainingPower = 0.8f;

        [Header("解锁条件")]
        public bool isUnlockedByDefault = true;
        public int requiredLevel = 0;

        [Header("传统信息")]
        public string traditionalSource;
        public string historicalPeriod;
    }
}
