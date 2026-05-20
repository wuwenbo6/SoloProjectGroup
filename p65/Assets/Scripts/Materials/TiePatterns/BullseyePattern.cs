using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "BullseyePattern", menuName = "TieDye/Patterns/Bullseye")]
    public class BullseyePattern : TiePattern
    {
        [Header("Bullseye Settings")]
        [Range(2, 10)] public int ringCount = 5;
        [Range(0.01f, 0.1f)] public float lineWidth = 0.02f;

        public override void ApplyToMask(bool[,] mask, int gridSize)
        {
            var centerX = gridSize / 2;
            var centerY = gridSize / 2;
            var maxRadius = gridSize / 2f;
            var ringSpacing = maxRadius / ringCount;

            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var dx = x - centerX;
                    var dy = y - centerY;
                    var radius = Mathf.Sqrt(dx * dx + dy * dy);
                    
                    var distanceFromRing = radius % ringSpacing;
                    if (distanceFromRing < lineWidth * gridSize || 
                        distanceFromRing > ringSpacing - lineWidth * gridSize)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }
    }
}