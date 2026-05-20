using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "FabricMaterial", menuName = "TieDye/Fabric Material")]
    public class FabricMaterial : ScriptableObject
    {
        public string fabricName;
        public Sprite previewIcon;
        public Color baseColor = Color.white;
        
        [Header("Absorption Properties")]
        [Range(0.1f, 2f)] public float absorptionRate = 1f;
        [Range(0.1f, 2f)] public float diffusionModifier = 1f;
        [Range(0.1f, 2f)] public float colorRetention = 1f;
        
        [Header("Visual Properties")]
        [Range(0f, 1f)] public float textureRoughness = 0.1f;
        public Color tintColor = Color.white;
        
        [Header("Gameplay")]
        public int unlockLevel = 1;
        public int price;
        [TextArea] public string description;
    }
}