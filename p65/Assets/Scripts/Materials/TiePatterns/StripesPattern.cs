using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "StripesPattern", menuName = "TieDye/Patterns/Stripes")]
    public class StripesPattern : TiePattern
    {
        public enum Direction { Horizontal, Vertical, Diagonal }
        
        [Header("Stripes Settings")]
        [Range(2, 20)] public int stripeCount = 8;
        [Range(0.01f, 0.1f)] public float lineWidth = 0.02f;
        public Direction direction = Direction.Horizontal;

        public override void ApplyToMask(bool[,] mask, int gridSize)
        {
            var spacing = gridSize / (float)stripeCount;

            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    float position;
                    switch (direction)
                    {
                        case Direction.Horizontal:
                            position = y;
                            break;
                        case Direction.Vertical:
                            position = x;
                            break;
                        case Direction.Diagonal:
                            position = x + y;
                            spacing *= 1.414f;
                            break;
                        default:
                            position = y;
                            break;
                    }
                    
                    var distanceFromLine = position % spacing;
                    if (distanceFromLine < lineWidth * gridSize || 
                        distanceFromLine > spacing - lineWidth * gridSize)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }
    }
}