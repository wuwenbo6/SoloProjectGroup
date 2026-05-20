using UnityEngine;
using UnityEngine.Tilemaps;
using CircuitSimulator.Core;

namespace CircuitSimulator.Scene
{
    public class CircuitGrid : MonoBehaviour
    {
        public static CircuitGrid Instance { get; private set; }

        [SerializeField] private Tilemap gridTilemap;
        [SerializeField] private Tile baseTile;
        [SerializeField] private Vector2Int gridSize = new Vector2Int(20, 15);
        [SerializeField] private float cellSize = 1f;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else
            {
                Destroy(gameObject);
            }

            InitializeGrid();
        }

        private void InitializeGrid()
        {
            if (gridTilemap == null)
            {
                var grid = new GameObject("Grid").AddComponent<Grid>();
                grid.transform.SetParent(transform);
                gridTilemap = new GameObject("Tilemap").AddComponent<Tilemap>();
                gridTilemap.transform.SetParent(grid.transform);
                gridTilemap.gameObject.AddComponent<TilemapRenderer>();
            }

            for (int x = -gridSize.x / 2; x < gridSize.x / 2; x++)
            {
                for (int y = -gridSize.y / 2; y < gridSize.y / 2; y++)
                {
                    Vector3Int tilePos = new Vector3Int(x, y, 0);
                    gridTilemap.SetTile(tilePos, baseTile);
                }
            }
        }

        public Vector2 SnapToGrid(Vector2 worldPosition)
        {
            Vector3Int cellPos = gridTilemap.WorldToCell(worldPosition);
            return gridTilemap.CellToWorld(cellPos);
        }

        public Vector3Int WorldToCell(Vector2 worldPosition)
        {
            return gridTilemap.WorldToCell(worldPosition);
        }

        public Vector2 CellToWorld(Vector3Int cellPosition)
        {
            return gridTilemap.CellToWorld(cellPosition);
        }

        public bool IsInBounds(Vector2 worldPosition)
        {
            Vector3Int cellPos = gridTilemap.WorldToCell(worldPosition);
            return Mathf.Abs(cellPos.x) < gridSize.x / 2 && Mathf.Abs(cellPos.y) < gridSize.y / 2;
        }

        public float GetCellSize()
        {
            return cellSize;
        }

        public Tilemap GetTilemap()
        {
            return gridTilemap;
        }
    }
}