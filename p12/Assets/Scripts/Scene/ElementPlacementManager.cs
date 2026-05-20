using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;
using CircuitSimulator.Components;

namespace CircuitSimulator.Scene
{
    public class ElementPlacementManager : MonoBehaviour
    {
        public static ElementPlacementManager Instance { get; private set; }

        public enum PlacementMode
        {
            Select,
            Place,
            Wire,
            Delete
        }

        [SerializeField] private GameObject voltageSourcePrefab;
        [SerializeField] private GameObject resistorPrefab;
        [SerializeField] private GameObject capacitorPrefab;
        [SerializeField] private GameObject diodePrefab;
        [SerializeField] private GameObject wirePrefab;

        private PlacementMode currentMode = PlacementMode.Select;
        private System.Type currentElementType;
        private GameObject previewElement;
        private CircuitElement selectedElement;
        private bool isPlacing;
        private Vector2 wireStartPosition;
        private bool isDrawingWire;
        private LineRenderer wirePreviewLine;

        private Camera mainCamera;

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

            mainCamera = Camera.main;
        }

        private void Update()
        {
            HandleInput();
            UpdatePreview();
        }

        private void HandleInput()
        {
            Vector2 mouseWorldPos = mainCamera.ScreenToWorldPoint(Input.mousePosition);

            if (Input.GetMouseButtonDown(0))
            {
                HandleLeftClick(mouseWorldPos);
            }
            else if (Input.GetMouseButtonUp(0))
            {
                HandleLeftRelease(mouseWorldPos);
            }
            else if (Input.GetMouseButtonDown(1))
            {
                HandleRightClick();
            }
            else if (Input.GetKeyDown(KeyCode.R))
            {
                RotateSelectedElement();
            }
            else if (Input.GetKeyDown(KeyCode.Delete) || Input.GetKeyDown(KeyCode.Backspace))
            {
                DeleteSelectedElement();
            }
        }

        private void HandleLeftClick(Vector2 position)
        {
            switch (currentMode)
            {
                case PlacementMode.Select:
                    SelectElementAtPosition(position);
                    break;
                case PlacementMode.Place:
                    PlaceElement(position);
                    break;
                case PlacementMode.Wire:
                    StartWire(position);
                    break;
                case PlacementMode.Delete:
                    DeleteElementAtPosition(position);
                    break;
            }
        }

        private void HandleLeftRelease(Vector2 position)
        {
            if (currentMode == PlacementMode.Wire && isDrawingWire)
            {
                EndWire(position);
            }
        }

        private void HandleRightClick()
        {
            CancelPlacement();
            DeselectElement();
        }

        public void SetPlacementMode(PlacementMode mode, System.Type elementType = null)
        {
            currentMode = mode;
            currentElementType = elementType;
            DestroyPreview();

            if (mode == PlacementMode.Place && elementType != null)
            {
                CreatePreview(elementType);
            }
        }

        private void CreatePreview(System.Type elementType)
        {
            GameObject prefab = GetPrefabForType(elementType);
            if (prefab != null)
            {
                previewElement = Instantiate(prefab);
                previewElement.SetActive(false);

                var collider = previewElement.GetComponent<Collider2D>();
                if (collider != null) collider.enabled = false;

                var spriteRenderer = previewElement.GetComponent<SpriteRenderer>();
                if (spriteRenderer != null)
                {
                    spriteRenderer.color = new Color(1f, 1f, 1f, 0.5f);
                }
            }
        }

        private void DestroyPreview()
        {
            if (previewElement != null)
            {
                Destroy(previewElement);
                previewElement = null;
            }
        }

        private void UpdatePreview()
        {
            if (previewElement != null && currentMode == PlacementMode.Place)
            {
                Vector2 mouseWorldPos = mainCamera.ScreenToWorldPoint(Input.mousePosition);
                Vector2 snappedPos = CircuitGrid.Instance.SnapToGrid(mouseWorldPos);

                previewElement.transform.position = snappedPos;
                previewElement.SetActive(CircuitGrid.Instance.IsInBounds(snappedPos));
            }

            if (isDrawingWire && wirePreviewLine != null)
            {
                Vector2 mouseWorldPos = mainCamera.ScreenToWorldPoint(Input.mousePosition);
                wirePreviewLine.SetPosition(1, mouseWorldPos);
            }
        }

        private void PlaceElement(Vector2 position)
        {
            Vector2 snappedPos = CircuitGrid.Instance.SnapToGrid(position);
            if (!CircuitGrid.Instance.IsInBounds(snappedPos)) return;

            GameObject prefab = GetPrefabForType(currentElementType);
            if (prefab != null)
            {
                GameObject newElement = Instantiate(prefab, snappedPos, Quaternion.identity);
                CircuitElement element = newElement.GetComponent<CircuitElement>();

                if (element != null)
                {
                    CircuitSimulator.Instance.RegisterElement(element);
                    selectedElement = element;
                }
            }
        }

        private void StartWire(Vector2 position)
        {
            var nearestNode = CircuitSimulator.Instance.FindNearestNode(position, 0.5f);
            if (nearestNode != null)
            {
                wireStartPosition = nearestNode.Position;
                isDrawingWire = true;

                if (wirePreviewLine == null)
                {
                    var lineObj = new GameObject("WirePreview");
                    wirePreviewLine = lineObj.AddComponent<LineRenderer>();
                    wirePreviewLine.startWidth = 0.05f;
                    wirePreviewLine.endWidth = 0.05f;
                    wirePreviewLine.material = new Material(Shader.Find("Sprites/Default"));
                    wirePreviewLine.startColor = Color.yellow;
                    wirePreviewLine.endColor = Color.yellow;
                }

                wirePreviewLine.SetPosition(0, wireStartPosition);
                wirePreviewLine.SetPosition(1, wireStartPosition);
            }
        }

        private void EndWire(Vector2 position)
        {
            var nearestNode = CircuitSimulator.Instance.FindNearestNode(position, 0.5f);
            if (nearestNode != null && !nearestNode.Position.Equals(wireStartPosition))
            {
                GameObject wireObj = Instantiate(wirePrefab);
                Wire wire = wireObj.GetComponent<Wire>();
                wire.SetEndpoints(wireStartPosition, nearestNode.Position);
                CircuitSimulator.Instance.RegisterElement(wire);

                var startNode = CircuitSimulator.Instance.FindNearestNode(wireStartPosition, 0.1f);
                if (startNode != null)
                {
                    CircuitSimulator.Instance.ConnectNodes(startNode, nearestNode);
                }
            }

            isDrawingWire = false;
            if (wirePreviewLine != null)
            {
                Destroy(wirePreviewLine.gameObject);
                wirePreviewLine = null;
            }
        }

        private void SelectElementAtPosition(Vector2 position)
        {
            Collider2D hit = Physics2D.OverlapPoint(position);
            if (hit != null)
            {
                selectedElement = hit.GetComponent<CircuitElement>();
            }
            else
            {
                selectedElement = null;
            }
        }

        private void DeleteElementAtPosition(Vector2 position)
        {
            Collider2D hit = Physics2D.OverlapPoint(position);
            if (hit != null)
            {
                CircuitElement element = hit.GetComponent<CircuitElement>();
                if (element != null)
                {
                    CircuitSimulator.Instance.UnregisterElement(element);
                    Destroy(element.gameObject);
                }
            }
        }

        private void RotateSelectedElement()
        {
            if (selectedElement != null)
            {
                selectedElement.Rotate(90f);
            }
        }

        private void DeleteSelectedElement()
        {
            if (selectedElement != null)
            {
                CircuitSimulator.Instance.UnregisterElement(selectedElement);
                Destroy(selectedElement.gameObject);
                selectedElement = null;
            }
        }

        private void CancelPlacement()
        {
            isDrawingWire = false;
            if (wirePreviewLine != null)
            {
                Destroy(wirePreviewLine.gameObject);
                wirePreviewLine = null;
            }
        }

        private void DeselectElement()
        {
            selectedElement = null;
        }

        private GameObject GetPrefabForType(System.Type type)
        {
            if (type == typeof(VoltageSource)) return voltageSourcePrefab;
            if (type == typeof(Resistor)) return resistorPrefab;
            if (type == typeof(Capacitor)) return capacitorPrefab;
            if (type == typeof(Diode)) return diodePrefab;
            if (type == typeof(Wire)) return wirePrefab;
            return null;
        }

        public CircuitElement GetSelectedElement()
        {
            return selectedElement;
        }

        public PlacementMode GetCurrentMode()
        {
            return currentMode;
        }

        private void OnDestroy()
        {
            DestroyPreview();
        }
    }
}