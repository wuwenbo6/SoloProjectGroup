using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace TieDyeGame.CustomTie
{
    public enum TieToolType
    {
        Point,
        Line,
        Circle,
        Rectangle,
        Spiral,
        Eraser
    }

    [Serializable]
    public class TieElement
    {
        public TieToolType type;
        public Vector2 startPoint;
        public Vector2 endPoint;
        public float radius;
        public float rotation;
        public int complexity;
    }

    [Serializable]
    public class CustomTiePattern
    {
        public string patternName;
        public List<TieElement> elements = new List<TieElement>();
        public int totalComplexity;
        public DateTime createdDate;
    }

    public class TieEditor : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private RawImage previewImage;
        [SerializeField] private RectTransform canvasRect;
        [SerializeField] private GameObject toolPanel;
        [SerializeField] private GameObject saveDialog;

        [Header("Tool Settings")]
        [SerializeField] private Color tieColor = new Color(0.3f, 0.3f, 0.3f);
        [SerializeField] private float defaultRadius = 0.05f;
        [SerializeField] private float lineWidth = 0.02f;

        [Header("Brush Settings")]
        [SerializeField] private Slider sizeSlider;
        [SerializeField] private TMPro.TMP_Text sizeLabel;

        [Header("Events")]
        public event Action<CustomTiePattern> OnPatternSaved;
        public event Action OnPatternCleared;

        private TieToolType _currentTool = TieToolType.Point;
        private List<TieElement> _elements = new List<TieElement>();
        private bool _isDrawing;
        private Vector2 _drawStartPos;
        private Texture2D _previewTexture;
        private int _gridSize = 128;
        private bool[,] _tieMask;
        private float _currentRadius;

        private void Awake()
        {
            InitializeEditor();
        }

        private void InitializeEditor()
        {
            _previewTexture = new Texture2D(_gridSize, _gridSize)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            previewImage.texture = _previewTexture;
            _tieMask = new bool[_gridSize, _gridSize];
            _currentRadius = defaultRadius;
            ClearPattern();
        }

        private void Update()
        {
            HandleInput();
        }

        private void HandleInput()
        {
            if (Input.GetMouseButtonDown(0) && !IsOverUI())
            {
                StartDrawing();
            }
            else if (Input.GetMouseButton(0) && _isDrawing)
            {
                ContinueDrawing();
            }
            else if (Input.GetMouseButtonUp(0) && _isDrawing)
            {
                EndDrawing();
            }
        }

        private bool IsOverUI()
        {
            var mousePos = Input.mousePosition;
            var canvasCorners = new Vector3[4];
            canvasRect.GetWorldCorners(canvasCorners);
            
            return mousePos.x < canvasCorners[0].x || mousePos.x > canvasCorners[2].x ||
                   mousePos.y < canvasCorners[0].y || mousePos.y > canvasCorners[2].y;
        }

        private void StartDrawing()
        {
            _isDrawing = true;
            _drawStartPos = GetNormalizedMousePosition();

            if (_currentTool is TieToolType.Point or TieToolType.Circle or TieToolType.Eraser)
            {
                ApplyDrawElement(_drawStartPos, _drawStartPos);
            }
        }

        private void ContinueDrawing()
        {
            if (_currentTool is TieToolType.Line or TieToolType.Eraser)
            {
                var currentPos = GetNormalizedMousePosition();
                ApplyDrawElement(_drawStartPos, currentPos);
                _drawStartPos = currentPos;
            }
            else if (_currentTool is TieToolType.Spiral)
            {
                UpdatePreview();
            }
        }

        private void EndDrawing()
        {
            _isDrawing = false;
            var endPos = GetNormalizedMousePosition();

            if (_currentTool != TieToolType.Point && _currentTool != TieToolType.Eraser)
            {
                ApplyDrawElement(_drawStartPos, endPos);
            }
        }

        private Vector2 GetNormalizedMousePosition()
        {
            var mousePos = Input.mousePosition;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                canvasRect, mousePos, null, out var localPos);
            
            var rect = canvasRect.rect;
            return new Vector2(
                Mathf.InverseLerp(rect.xMin, rect.xMax, localPos.x),
                Mathf.InverseLerp(rect.yMin, rect.yMax, localPos.y)
            );
        }

        private void ApplyDrawElement(Vector2 start, Vector2 end)
        {
            var element = new TieElement
            {
                type = _currentTool,
                startPoint = start,
                endPoint = end,
                radius = _currentRadius
            };

            switch (_currentTool)
            {
                case TieToolType.Point:
                    DrawPointMask(start, _currentRadius, false);
                    element.complexity = 10;
                    break;
                case TieToolType.Line:
                    DrawLineMask(start, end, lineWidth, false);
                    element.complexity = 15;
                    break;
                case TieToolType.Circle:
                    DrawCircleMask(start, end, false);
                    element.complexity = 20;
                    break;
                case TieToolType.Rectangle:
                    DrawRectMask(start, end, false);
                    element.complexity = 25;
                    break;
                case TieToolType.Spiral:
                    DrawSpiralMask(start, end, false);
                    element.complexity = 35;
                    break;
                case TieToolType.Eraser:
                    DrawPointMask(start, _currentRadius * 1.5f, true);
                    return;
            }

            _elements.Add(element);
            UpdatePreview();
        }

        private void DrawPointMask(Vector2 center, float radius, bool erase)
        {
            var centerX = Mathf.FloorToInt(center.x * _gridSize);
            var centerY = Mathf.FloorToInt(center.y * _gridSize);
            var pixelRadius = Mathf.FloorToInt(radius * _gridSize);

            for (var x = centerX - pixelRadius; x <= centerX + pixelRadius; x++)
            {
                for (var y = centerY - pixelRadius; y <= centerY + pixelRadius; y++)
                {
                    if (x < 0 || x >= _gridSize || y < 0 || y >= _gridSize) continue;

                    var distance = Vector2.Distance(new Vector2(x, y), new Vector2(centerX, centerY));
                    if (distance <= pixelRadius)
                    {
                        _tieMask[x, y] = !erase;
                    }
                }
            }
        }

        private void DrawLineMask(Vector2 start, Vector2 end, float width, bool erase)
        {
            var startX = Mathf.FloorToInt(start.x * _gridSize);
            var startY = Mathf.FloorToInt(start.y * _gridSize);
            var endX = Mathf.FloorToInt(end.x * _gridSize);
            var endY = Mathf.FloorToInt(end.y * _gridSize);
            var pixelWidth = Mathf.FloorToInt(width * _gridSize);

            var dx = Mathf.Abs(endX - startX);
            var dy = Mathf.Abs(endY - startY);
            var sx = startX < endX ? 1 : -1;
            var sy = startY < endY ? 1 : -1;
            var err = dx - dy;

            while (true)
            {
                for (var wx = -pixelWidth; wx <= pixelWidth; wx++)
                {
                    for (var wy = -pixelWidth; wy <= pixelWidth; wy++)
                    {
                        var x = startX + wx;
                        var y = startY + wy;
                        if (x >= 0 && x < _gridSize && y >= 0 && y < _gridSize)
                        {
                            if (wx * wx + wy * wy <= pixelWidth * pixelWidth)
                            {
                                _tieMask[x, y] = !erase;
                            }
                        }
                    }
                }

                if (startX == endX && startY == endY) break;

                var e2 = 2 * err;
                if (e2 > -dy)
                {
                    err -= dy;
                    startX += sx;
                }
                if (e2 < dx)
                {
                    err += dx;
                    startY += sy;
                }
            }
        }

        private void DrawCircleMask(Vector2 center, Vector2 edge, bool erase)
        {
            var radius = Vector2.Distance(center, edge);
            DrawPointMask(center, radius, erase);
        }

        private void DrawRectMask(Vector2 corner1, Vector2 corner2, bool erase)
        {
            var minX = Mathf.FloorToInt(Mathf.Min(corner1.x, corner2.x) * _gridSize);
            var maxX = Mathf.FloorToInt(Mathf.Max(corner1.x, corner2.x) * _gridSize);
            var minY = Mathf.FloorToInt(Mathf.Min(corner1.y, corner2.y) * _gridSize);
            var maxY = Mathf.FloorToInt(Mathf.Max(corner1.y, corner2.y) * _gridSize);

            for (var x = minX; x <= maxX; x++)
            {
                for (var y = minY; y <= maxY; y++)
                {
                    if (x >= 0 && x < _gridSize && y >= 0 && y < _gridSize)
                    {
                        var isEdge = x == minX || x == maxX || y == minY || y == maxY;
                        var isNearEdge = Mathf.Abs(x - minX) <= 2 || Mathf.Abs(x - maxX) <= 2 ||
                                        Mathf.Abs(y - minY) <= 2 || Mathf.Abs(y - maxY) <= 2;
                        if (isNearEdge)
                        {
                            _tieMask[x, y] = !erase;
                        }
                    }
                }
            }
        }

        private void DrawSpiralMask(Vector2 center, Vector2 control, bool erase)
        {
            var centerX = Mathf.FloorToInt(center.x * _gridSize);
            var centerY = Mathf.FloorToInt(center.y * _gridSize);
            var maxRadius = Mathf.FloorToInt(Vector2.Distance(center, control) * _gridSize);
            var armCount = 3;
            var linePixelWidth = Mathf.FloorToInt(lineWidth * _gridSize);

            for (var x = centerX - maxRadius; x <= centerX + maxRadius; x++)
            {
                for (var y = centerY - maxRadius; y <= centerY + maxRadius; y++)
                {
                    if (x < 0 || x >= _gridSize || y < 0 || y >= _gridSize) continue;

                    var dx = x - centerX;
                    var dy = y - centerY;
                    var radius = Mathf.Sqrt(dx * dx + dy * dy);
                    
                    if (radius > maxRadius) continue;

                    var angle = Mathf.Atan2(dy, dx);
                    var spiralAngle = angle + (radius / maxRadius) * Mathf.PI * 2 * armCount;
                    var normalizedAngle = (spiralAngle % Mathf.PI + Mathf.PI) % Mathf.PI;
                    var segmentWidth = Mathf.PI / armCount;
                    var distanceFromLine = Mathf.Abs(normalizedAngle % segmentWidth - segmentWidth / 2);

                    if (distanceFromLine < lineWidth * Mathf.PI)
                    {
                        _tieMask[x, y] = !erase;
                    }
                }
            }
        }

        private void UpdatePreview()
        {
            for (var x = 0; x < _gridSize; x++)
            {
                for (var y = 0; y < _gridSize; y++)
                {
                    _previewTexture.SetPixel(x, y, _tieMask[x, y] ? tieColor : Color.white);
                }
            }
            _previewTexture.Apply(false);
        }

        public void SelectTool(int toolIndex)
        {
            _currentTool = (TieToolType)toolIndex;
            toolPanel.SetActive(false);
        }

        public void OnSizeChanged()
        {
            _currentRadius = sizeSlider.value;
            sizeLabel.text = $"尺寸: {_currentRadius:P0}";
        }

        public void ClearPattern()
        {
            _elements.Clear();
            for (var x = 0; x < _gridSize; x++)
            {
                for (var y = 0; y < _gridSize; y++)
                {
                    _tieMask[x, y] = false;
                }
            }
            UpdatePreview();
            OnPatternCleared?.Invoke();
        }

        public void UndoLast()
        {
            if (_elements.Count > 0)
            {
                _elements.RemoveAt(_elements.Count - 1);
                RebuildMask();
                UpdatePreview();
            }
        }

        private void RebuildMask()
        {
            for (var x = 0; x < _gridSize; x++)
            {
                for (var y = 0; y < _gridSize; y++)
                {
                    _tieMask[x, y] = false;
                }
            }

            foreach (var element in _elements)
            {
                switch (element.type)
                {
                    case TieToolType.Point:
                        DrawPointMask(element.startPoint, element.radius, false);
                        break;
                    case TieToolType.Line:
                        DrawLineMask(element.startPoint, element.endPoint, lineWidth, false);
                        break;
                    case TieToolType.Circle:
                        DrawCircleMask(element.startPoint, element.endPoint, false);
                        break;
                    case TieToolType.Rectangle:
                        DrawRectMask(element.startPoint, element.endPoint, false);
                        break;
                    case TieToolType.Spiral:
                        DrawSpiralMask(element.startPoint, element.endPoint, false);
                        break;
                }
            }
        }

        public void ShowSaveDialog()
        {
            saveDialog.SetActive(true);
        }

        public void HideSaveDialog()
        {
            saveDialog.SetActive(false);
        }

        public void SavePattern(string patternName)
        {
            var customPattern = new CustomTiePattern
            {
                patternName = patternName,
                elements = new List<TieElement>(_elements),
                createdDate = DateTime.Now
            };

            foreach (var element in _elements)
            {
                customPattern.totalComplexity += element.complexity;
            }

            OnPatternSaved?.Invoke(customPattern);
            HideSaveDialog();
        }

        public bool[,] GetTieMask()
        {
            return (bool[,])_tieMask.Clone();
        }

        public int GetComplexity()
        {
            var total = 0;
            foreach (var element in _elements)
            {
                total += element.complexity;
            }
            return total;
        }

        public int GetElementCount()
        {
            return _elements.Count;
        }

        public void LoadPattern(CustomTiePattern pattern)
        {
            _elements = new List<TieElement>(pattern.elements);
            RebuildMask();
            UpdatePreview();
        }

        public void ToggleToolPanel()
        {
            toolPanel.SetActive(!toolPanel.activeSelf);
        }

        private void OnDestroy()
        {
            if (_previewTexture != null)
            {
                Destroy(_previewTexture);
            }
        }
    }
}