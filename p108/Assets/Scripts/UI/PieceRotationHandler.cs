using UnityEngine;
using MortiseTenonGame.MortiseTenon;

namespace MortiseTenonGame.UI
{
    public class PieceRotationHandler : MonoBehaviour
    {
        [Header("Rotation Settings")]
        [SerializeField] private float _rotationSpeed = 100f;
        [SerializeField] private float _fineRotationSpeed = 15f;
        [SerializeField] private bool _snapTo90Degrees = true;

        [Header("UI References")]
        [SerializeField] private GameObject _rotationGizmoPrefab;

        private MortiseTenonPiece _selectedPiece;
        private GameObject _rotationGizmo;
        private bool _isRotating;
        private Vector2 _lastMousePosition;

        private void Update()
        {
            HandleRotationInput();
        }

        private void HandleRotationInput()
        {
            _selectedPiece = PieceManager.Instance.SelectedPiece;

            if (_selectedPiece == null)
            {
                HideRotationGizmo();
                return;
            }

            ShowRotationGizmo();

            if (Input.GetKey(KeyCode.R))
            {
                HandleKeyRotation();
            }

            if (Input.GetMouseButton(2))
            {
                HandleMouseRotation();
            }
        }

        private void HandleKeyRotation()
        {
            float speed = Input.GetKey(KeyCode.LeftShift) ? _fineRotationSpeed : _rotationSpeed;

            if (Input.GetKey(KeyCode.X))
            {
                _selectedPiece.transform.Rotate(Vector3.right, speed * Time.deltaTime, Space.World);
            }
            else if (Input.GetKey(KeyCode.Y))
            {
                _selectedPiece.transform.Rotate(Vector3.up, speed * Time.deltaTime, Space.World);
            }
            else if (Input.GetKey(KeyCode.Z))
            {
                _selectedPiece.transform.Rotate(Vector3.forward, speed * Time.deltaTime, Space.World);
            }
        }

        private void HandleMouseRotation()
        {
            if (!_isRotating)
            {
                _isRotating = true;
                _lastMousePosition = Input.mousePosition;
                return;
            }

            Vector2 mouseDelta = (Vector2)Input.mousePosition - _lastMousePosition;
            float speed = Input.GetKey(KeyCode.LeftShift) ? _fineRotationSpeed : _rotationSpeed;

            _selectedPiece.transform.Rotate(Vector3.up, mouseDelta.x * speed * 0.01f, Space.World);
            _selectedPiece.transform.Rotate(Vector3.right, -mouseDelta.y * speed * 0.01f, Space.World);

            _lastMousePosition = Input.mousePosition;
        }

        private void ShowRotationGizmo()
        {
            if (_rotationGizmo == null && _rotationGizmoPrefab != null)
            {
                _rotationGizmo = Instantiate(_rotationGizmoPrefab, _selectedPiece.transform);
                _rotationGizmo.transform.localPosition = Vector3.zero;
            }
            else if (_rotationGizmo != null)
            {
                _rotationGizmo.SetActive(true);
                _rotationGizmo.transform.SetParent(_selectedPiece.transform);
                _rotationGizmo.transform.localPosition = Vector3.zero;
            }
        }

        private void HideRotationGizmo()
        {
            if (_rotationGizmo != null)
            {
                _rotationGizmo.SetActive(false);
            }
        }

        public void SnapRotation()
        {
            if (_selectedPiece != null)
            {
                Vector3 euler = _selectedPiece.transform.eulerAngles;
                euler.x = Mathf.Round(euler.x / 90f) * 90f;
                euler.y = Mathf.Round(euler.y / 90f) * 90f;
                euler.z = Mathf.Round(euler.z / 90f) * 90f;
                _selectedPiece.transform.eulerAngles = euler;
            }
        }

        public void ResetRotation()
        {
            if (_selectedPiece != null)
            {
                _selectedPiece.transform.rotation = Quaternion.identity;
            }
        }

        public void RotateX(bool positive)
        {
            if (_selectedPiece != null)
            {
                float angle = _snapTo90Degrees ? 90f : 15f;
                _selectedPiece.transform.Rotate(Vector3.right, positive ? angle : -angle, Space.World);
            }
        }

        public void RotateY(bool positive)
        {
            if (_selectedPiece != null)
            {
                float angle = _snapTo90Degrees ? 90f : 15f;
                _selectedPiece.transform.Rotate(Vector3.up, positive ? angle : -angle, Space.World);
            }
        }

        public void RotateZ(bool positive)
        {
            if (_selectedPiece != null)
            {
                float angle = _snapTo90Degrees ? 90f : 15f;
                _selectedPiece.transform.Rotate(Vector3.forward, positive ? angle : -angle, Space.World);
            }
        }
    }
}