using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "SpiralPattern", menuName = "TieDye/Patterns/Spiral")]
    public class SpiralPattern : TiePattern
    {
        [Header("Spiral Settings")]
        [Range(1, 10)] public int armCount = 3;
        [Range(0.01f, 0.1f)] public float lineWidth = 0.03f;

        public override void ApplyToMask(bool[,] mask, int gridSize)
        {
            var centerX = gridSize / 2;
            var centerY = gridSize / 2;
            var maxRadius = gridSize / 2f;

            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var dx = x - centerX;
                    var dy = y - centerY;
                    var radius = Mathf.Sqrt(dx * dx + dy * dy);
                    var angle = Mathf.Atan2(dy, dx);
                    
                    var spiralAngle = angle + (radius / maxRadius) * Mathf.PI * 2 * armCount;
                    var normalizedAngle = (spiralAngle % Mathf.PI + Mathf.PI) % Mathf.PI;
                    
                    var segmentWidth = Mathf.PI / armCount;
                    var distanceFromLine = Mathf.Abs(normalizedAngle % segmentWidth - segmentWidth / 2);
                    
                    if (distanceFromLine < lineWidth * Mathf.PI)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }
    }
}