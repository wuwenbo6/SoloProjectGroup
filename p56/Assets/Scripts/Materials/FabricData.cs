using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "NewFabric", menuName = "TieDye/Fabric")]
    public class FabricData : ScriptableObject
    {
        [Header("布料基本信息")]
        public string fabricName;
        [TextArea]
        public string description;
        public Sprite previewImage;

        [Header("布料物理属性")]
        public float absorptionRate = 0.1f;
        public float diffusionMultiplier = 1f;
        public float weaveDensity = 1f;

        [Header("布料视觉属性")]
        public Color baseColor = Color.white;
        public Texture2D baseTexture;

        [Header("解锁条件")]
        public bool isUnlockedByDefault = true;
        public int requiredLevel = 0;
    }
}
