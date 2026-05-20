using UnityEngine;

namespace TieDyeGame.Materials
{
    [CreateAssetMenu(fileName = "FoldingPattern", menuName = "TieDye/Patterns/Folding")]
    public class FoldingPattern : TiePattern
    {
        public enum FoldType { Accordion, Triangle, Square }
        
        [Header("Folding Settings")]
        [Range(2, 8)] public int foldCount = 4;
        [Range(0.01f, 0.05f)] public float lineWidth = 0.015f;
        public FoldType foldType = FoldType.Accordion;

        public override void ApplyToMask(bool[,] mask, int gridSize)
        {
            switch (foldType)
            {
                case FoldType.Accordion:
                    ApplyAccordionFold(mask, gridSize);
                    break;
                case FoldType.Triangle:
                    ApplyTriangleFold(mask, gridSize);
                    break;
                case FoldType.Square:
                    ApplySquareFold(mask, gridSize);
                    break;
            }
        }

        private void ApplyAccordionFold(bool[,] mask, int gridSize)
        {
            var spacing = gridSize / (float)foldCount;
            
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var distanceH = y % spacing;
                    var distanceV = x % spacing;
                    
                    if (distanceH < lineWidth * gridSize || 
                        distanceH > spacing - lineWidth * gridSize ||
                        distanceV < lineWidth * gridSize || 
                        distanceV > spacing - lineWidth * gridSize)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }

        private void ApplyTriangleFold(bool[,] mask, int gridSize)
        {
            var centerX = gridSize / 2;
            var centerY = gridSize / 2;
            
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var dx = x - centerX;
                    var dy = y - centerY;
                    var angle = Mathf.Atan2(dy, dx);
                    var segmentAngle = Mathf.PI * 2 / foldCount;
                    
                    var distanceFromSegment = Mathf.Abs(angle % segmentAngle - segmentAngle / 2);
                    if (distanceFromSegment < lineWidth * Mathf.PI)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }

        private void ApplySquareFold(bool[,] mask, int gridSize)
        {
            var centerX = gridSize / 2;
            var centerY = gridSize / 2;
            var maxSize = gridSize / (float)foldCount;
            
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var dx = Mathf.Abs(x - centerX);
                    var dy = Mathf.Abs(y - centerY);
                    var maxDist = Mathf.Max(dx, dy);
                    
                    var distanceFromEdge = maxDist % maxSize;
                    if (distanceFromEdge < lineWidth * gridSize || 
                        distanceFromEdge > maxSize - lineWidth * gridSize)
                    {
                        mask[x, y] = true;
                    }
                }
            }
        }
    }
}