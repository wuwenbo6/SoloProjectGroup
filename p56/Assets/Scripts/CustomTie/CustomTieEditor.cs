using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.CustomTie
{
    public class CustomTieEditor : MonoBehaviour
    {
        [Header("编辑器设置")]
        public int patternResolution = 256;
        public float brushSize = 0.05f;
        public float tieStrength = 0.8f;

        [Header("工具设置")]
        public TieTool currentTool = TieTool.Brush;

        [Header("引用")]
        public GameObject fabricPlane;
        public Camera editorCamera;

        private Texture2D tiePatternTexture;
        private bool[,] tiePatternGrid;
        private List<TiePattern> savedPatterns = new List<TiePattern>();
        private bool isDrawing = false;
        private Vector2 lastDrawPos;

        private Stack<TieAction> undoStack = new Stack<TieAction>();
        private Stack<TieAction> redoStack = new Stack<TieAction>();

        public System.Action<TiePattern> OnPatternSaved;
        public System.Action OnPatternModified;

        private void Start()
        {
            InitializeEditor();
        }

        private void InitializeEditor()
        {
            tiePatternTexture = new Texture2D(patternResolution, patternResolution, TextureFormat.ARGB32, false);
            tiePatternGrid = new bool[patternResolution, patternResolution];

            Color clearColor = Color.white;
            for (int x = 0; x < patternResolution; x++)
            {
                for (int y = 0; y < patternResolution; y++)
                {
                    tiePatternGrid[x, y] = false;
                    tiePatternTexture.SetPixel(x, y, clearColor);
                }
            }
            tiePatternTexture.Apply();

            Renderer renderer = fabricPlane.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.mainTexture = tiePatternTexture;
            }
        }

        private void Update()
        {
            if (GameManager.Instance.currentState != GameState.LevelPlaying) return;

            HandleInput();
            HandleShortcuts();
        }

        private void HandleInput()
        {
            Ray ray = editorCamera.ScreenPointToRay(Input.mousePosition);
            RaycastHit hit;

            if (Physics.Raycast(ray, out hit))
            {
                Vector2 uv = hit.textureCoord;

                if (Input.GetMouseButtonDown(0))
                {
                    isDrawing = true;
                    lastDrawPos = uv;
                    BeginDrawAction();
                    ApplyToolAtPosition(uv);
                }
                else if (Input.GetMouseButton(0) && isDrawing)
                {
                    InterpolateDraw(lastDrawPos, uv);
                    lastDrawPos = uv;
                }
                else if (Input.GetMouseButtonUp(0))
                {
                    isDrawing = false;
                    EndDrawAction();
                }
            }
        }

        private void HandleShortcuts()
        {
            if (Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl))
            {
                if (Input.GetKeyDown(KeyCode.Z))
                {
                    Undo();
                }
                else if (Input.GetKeyDown(KeyCode.Y))
                {
                    Redo();
                }
                else if (Input.GetKeyDown(KeyCode.S))
                {
                    SaveCurrentPattern();
                }
            }

            if (Input.GetKeyDown(KeyCode.Alpha1)) currentTool = TieTool.Brush;
            if (Input.GetKeyDown(KeyCode.Alpha2)) currentTool = TieTool.Eraser;
            if (Input.GetKeyDown(KeyCode.Alpha3)) currentTool = TieTool.Circle;
            if (Input.GetKeyDown(KeyCode.Alpha4)) currentTool = TieTool.Rectangle;
            if (Input.GetKeyDown(KeyCode.Alpha5)) currentTool = TieTool.Spiral;
        }

        private void BeginDrawAction()
        {
            redoStack.Clear();
        }

        private void EndDrawAction()
        {
            OnPatternModified?.Invoke();
        }

        private void ApplyToolAtPosition(Vector2 uv)
        {
            int centerX = Mathf.FloorToInt(uv.x * patternResolution);
            int centerY = Mathf.FloorToInt(uv.y * patternResolution);
            int pixelRadius = Mathf.Max(1, Mathf.FloorToInt(brushSize * patternResolution));

            switch (currentTool)
            {
                case TieTool.Brush:
                    DrawBrush(centerX, centerY, pixelRadius, true);
                    break;
                case TieTool.Eraser:
                    DrawBrush(centerX, centerY, pixelRadius, false);
                    break;
                case TieTool.Circle:
                    DrawCircle(centerX, centerY, pixelRadius, true);
                    break;
                case TieTool.Rectangle:
                    DrawRectangle(centerX, centerY, pixelRadius, pixelRadius * 2, true);
                    break;
                case TieTool.Spiral:
                    DrawSpiral(centerX, centerY, pixelRadius);
                    break;
            }

            tiePatternTexture.Apply();
        }

        private void InterpolateDraw(Vector2 fromUV, Vector2 toUV)
        {
            float distance = Vector2.Distance(fromUV, toUV);
            int steps = Mathf.Max(1, Mathf.FloorToInt(distance * patternResolution * 2));

            for (int i = 1; i <= steps; i++)
            {
                float t = (float)i / steps;
                Vector2 interpolated = Vector2.Lerp(fromUV, toUV, t);
                ApplyToolAtPosition(interpolated);
            }
        }

        private void DrawBrush(int centerX, int centerY, int radius, bool isTie)
        {
            float radiusSquared = radius * radius;

            for (int x = -radius; x <= radius; x++)
            {
                for (int y = -radius; y <= radius; y++)
                {
                    int px = centerX + x;
                    int py = centerY + y;

                    if (px >= 0 && px < patternResolution && py >= 0 && py < patternResolution)
                    {
                        float distanceSquared = x * x + y * y;
                        if (distanceSquared <= radiusSquared)
                        {
                            float falloff = 1f - Mathf.Sqrt(distanceSquared) / radius;
                            if (falloff > 0.3f)
                            {
                                tiePatternGrid[px, py] = isTie;
                                tiePatternTexture.SetPixel(px, py, isTie ? Color.black : Color.white);
                            }
                        }
                    }
                }
            }
        }

        private void DrawCircle(int centerX, int centerY, int radius, bool isTie)
        {
            int thickness = Mathf.Max(2, radius / 5);
            float outerRadiusSquared = radius * radius;
            float innerRadiusSquared = (radius - thickness) * (radius - thickness);

            for (int x = -radius; x <= radius; x++)
            {
                for (int y = -radius; y <= radius; y++)
                {
                    int px = centerX + x;
                    int py = centerY + y;

                    if (px >= 0 && px < patternResolution && py >= 0 && py < patternResolution)
                    {
                        float distanceSquared = x * x + y * y;
                        if (distanceSquared <= outerRadiusSquared && distanceSquared >= innerRadiusSquared)
                        {
                            tiePatternGrid[px, py] = isTie;
                            tiePatternTexture.SetPixel(px, py, isTie ? Color.black : Color.white);
                        }
                    }
                }
            }
        }

        private void DrawRectangle(int centerX, int centerY, int width, int height, bool isTie)
        {
            int halfW = width / 2;
            int halfH = height / 2;

            for (int x = -halfW; x <= halfW; x++)
            {
                for (int y = -halfH; y <= halfH; y++)
                {
                    int px = centerX + x;
                    int py = centerY + y;

                    if (px >= 0 && px < patternResolution && py >= 0 && py < patternResolution)
                    {
                        tiePatternGrid[px, py] = isTie;
                        tiePatternTexture.SetPixel(px, py, isTie ? Color.black : Color.white);
                    }
                }
            }
        }

        private void DrawSpiral(int centerX, int centerY, int maxRadius)
        {
            float turns = 3f;
            float thickness = 3f;

            for (float angle = 0; angle < turns * Mathf.PI * 2; angle += 0.05f)
            {
                float radius = (angle / (turns * Mathf.PI * 2)) * maxRadius;
                int x = Mathf.FloorToInt(centerX + Mathf.Cos(angle) * radius);
                int y = Mathf.FloorToInt(centerY + Mathf.Sin(angle) * radius);

                for (int dx = -2; dx <= 2; dx++)
                {
                    for (int dy = -2; dy <= 2; dy++)
                    {
                        int px = x + dx;
                        int py = y + dy;

                        if (px >= 0 && px < patternResolution && py >= 0 && py < patternResolution)
                        {
                            tiePatternGrid[px, py] = true;
                            tiePatternTexture.SetPixel(px, py, Color.black);
                        }
                    }
                }
            }
        }

        public void Undo()
        {
            if (undoStack.Count > 0)
            {
                TieAction action = undoStack.Pop();
                redoStack.Push(action);
                action.Undo(tiePatternGrid, tiePatternTexture);
                tiePatternTexture.Apply();
            }
        }

        public void Redo()
        {
            if (redoStack.Count > 0)
            {
                TieAction action = redoStack.Pop();
                undoStack.Push(action);
                action.Redo(tiePatternGrid, tiePatternTexture);
                tiePatternTexture.Apply();
            }
        }

        public void ClearPattern()
        {
            for (int x = 0; x < patternResolution; x++)
            {
                for (int y = 0; y < patternResolution; y++)
                {
                    tiePatternGrid[x, y] = false;
                    tiePatternTexture.SetPixel(x, y, Color.white);
                }
            }
            tiePatternTexture.Apply();
            OnPatternModified?.Invoke();
        }

        public void SaveCurrentPattern()
        {
            TiePattern pattern = new TiePattern
            {
                id = System.Guid.NewGuid().ToString(),
                name = $"自定义图案_{savedPatterns.Count + 1}",
                author = "玩家",
                createdAt = System.DateTime.Now.ToString(),
                patternData = GetPatternData(),
                thumbnail = GetThumbnail()
            };

            savedPatterns.Add(pattern);
            OnPatternSaved?.Invoke(pattern);
        }

        public void LoadPattern(TiePattern pattern)
        {
            if (pattern.patternData == null || pattern.patternData.Length != patternResolution * patternResolution)
                return;

            for (int i = 0; i < pattern.patternData.Length; i++)
            {
                int x = i % patternResolution;
                int y = i / patternResolution;
                tiePatternGrid[x, y] = pattern.patternData[i];
                tiePatternTexture.SetPixel(x, y, pattern.patternData[i] ? Color.black : Color.white);
            }
            tiePatternTexture.Apply();
            OnPatternModified?.Invoke();
        }

        public bool[] GetPatternData()
        {
            bool[] data = new bool[patternResolution * patternResolution];
            for (int x = 0; x < patternResolution; x++)
            {
                for (int y = 0; y < patternResolution; y++)
                {
                    data[y * patternResolution + x] = tiePatternGrid[x, y];
                }
            }
            return data;
        }

        public Texture2D GetThumbnail()
        {
            Texture2D thumbnail = new Texture2D(64, 64);
            TextureScale.Bilinear(tiePatternTexture, 64, 64);
            thumbnail.SetPixels(tiePatternTexture.GetPixels());
            thumbnail.Apply();
            return thumbnail;
        }

        public List<Vector2> GetTiePoints()
        {
            List<Vector2> points = new List<Vector2>();
            for (int x = 0; x < patternResolution; x++)
            {
                for (int y = 0; y < patternResolution; y++)
                {
                    if (tiePatternGrid[x, y])
                    {
                        points.Add(new Vector2((float)x / patternResolution, (float)y / patternResolution));
                    }
                }
            }
            return points;
        }

        public void ApplyToSimulation(DyePhysics.DyeSimulation simulation)
        {
            var tiePoints = GetTiePoints();
            simulation.ClearBlockedRegions();
            simulation.SetBlockedRegion(tiePoints, 0.01f);
        }

        public void SetBrushSize(float size)
        {
            brushSize = Mathf.Clamp01(size);
        }

        public void SetTool(TieTool tool)
        {
            currentTool = tool;
        }
    }

    public enum TieTool
    {
        Brush,
        Eraser,
        Circle,
        Rectangle,
        Spiral
    }

    [System.Serializable]
    public class TiePattern
    {
        public string id;
        public string name;
        public string author;
        public string createdAt;
        public bool[] patternData;
        public Texture2D thumbnail;
        public int likes;
    }

    public abstract class TieAction
    {
        public abstract void Undo(bool[,] grid, Texture2D texture);
        public abstract void Redo(bool[,] grid, Texture2D texture);
    }

    public static class TextureScale
    {
        public static void Bilinear(Texture2D tex, int newWidth, int newHeight)
        {
        }
    }
}
