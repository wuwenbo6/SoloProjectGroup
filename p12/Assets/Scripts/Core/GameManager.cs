using UnityEngine;

namespace CircuitSimulator.Core
{
    public class GameManager : MonoBehaviour
    {
        [SerializeField] private Camera mainCamera;
        [SerializeField] private float zoomSpeed = 2f;
        [SerializeField] private float minZoom = 5f;
        [SerializeField] private float maxZoom = 20f;

        private Vector3 dragOrigin;
        private bool isDragging;

        private void Start()
        {
            if (mainCamera == null)
            {
                mainCamera = Camera.main;
            }

            Application.targetFrameRate = 60;
        }

        private void Update()
        {
            HandleCameraZoom();
            HandleCameraDrag();
        }

        private void HandleCameraZoom()
        {
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.01f)
            {
                float newSize = mainCamera.orthographicSize - scroll * zoomSpeed;
                mainCamera.orthographicSize = Mathf.Clamp(newSize, minZoom, maxZoom);
            }
        }

        private void HandleCameraDrag()
        {
            if (Input.GetMouseButtonDown(2))
            {
                dragOrigin = mainCamera.ScreenToWorldPoint(Input.mousePosition);
                isDragging = true;
            }

            if (Input.GetMouseButton(2) && isDragging)
            {
                Vector3 difference = dragOrigin - mainCamera.ScreenToWorldPoint(Input.mousePosition);
                mainCamera.transform.position += difference;
            }

            if (Input.GetMouseButtonUp(2))
            {
                isDragging = false;
            }
        }

        public void ResetCamera()
        {
            mainCamera.transform.position = new Vector3(0, 0, -10f);
            mainCamera.orthographicSize = 10f;
        }
    }
}