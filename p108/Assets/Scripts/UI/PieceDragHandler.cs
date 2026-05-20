using UnityEngine;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.UI
{
    public class PieceDragHandler : MonoBehaviour
    {
        [Header("Drag Settings")]
        [SerializeField] private Camera _mainCamera;
        [SerializeField] private LayerMask _pieceLayer;
        [SerializeField] private float _dragSpeed = 15f;
        [SerializeField] private float _rotationSpeed = 100f;
        [SerializeField] private bool _useSmoothDrag = true;
        [SerializeField] private bool _useVelocityDrag = true;
        [SerializeField] private float _dragDamping = 0.95f;

        [Header("Snap Settings")]
        [SerializeField] private bool _enablePositionSnap = true;
        [SerializeField] private float _positionSnapDistance = 0.05f;
        [SerializeField] private bool _enableRotationSnap = true;
        [SerializeField] private float _rotationSnapAngle = 15f;
        [SerializeField] private float _snapStrength = 0.8f;

        [Header("Connection Settings")]
        [SerializeField] private float _checkConnectionRadius = 0.15f;
        [SerializeField] private bool _autoConnectOnRelease = true;
        [SerializeField] private bool _showConnectionPreview = true;
        [SerializeField] private float _previewSnapDistance = 0.1f;

        [Header("Physics Settings")]
        [SerializeField] private float _maxDragVelocity = 5f;
        [SerializeField] private float _angularDrag = 0.1f;
        [SerializeField] private bool _useCollisionPrevention = true;
        [SerializeField] private float _collisionOffset = 0.02f;

        [Header("Input Settings")]
        [SerializeField] private float _doubleClickTime = 0.3f;
        [SerializeField] private float _dragThreshold = 0.01f;

        private MortiseTenonPiece _draggedPiece;
        private MortiseTenonJoint _nearbyJoint;
        private Vector3 _targetPosition;
        private Quaternion _targetRotation;
        private Vector3 _velocity;
        private Vector3 _angularVelocity;
        private bool _isDragging;
        private bool _isRotating;
        private Plane _dragPlane;
        private float _lastClickTime;
        private Vector3 _lastMousePosition;
        private Vector3 _dragStartPosition;
        private Quaternion _dragStartRotation;
        private bool _hasMovedBeyondThreshold;

        private void Awake()
        {
            if (_mainCamera == null)
            {
                _mainCamera = Camera.main;
            }
        }

        private void Update()
        {
            HandleMouseInput();
            HandleKeyboardInput();
        }

        private void FixedUpdate()
        {
            if (_isDragging && _draggedPiece != null)
            {
                UpdateDragPosition();
                UpdateDragRotation();
                CheckNearbyJoints();
                PreventCollisions();
            }
        }

        private void HandleMouseInput()
        {
            if (Input.GetMouseButtonDown(0))
            {
                HandleLeftMouseDown();
            }
            else if (Input.GetMouseButtonUp(0) && _isDragging)
            {
                HandleLeftMouseUp();
            }
            else if (Input.GetMouseButtonDown(1))
            {
                HandleRightMouseDown();
            }
            else if (Input.GetMouseButton(1) && _isDragging)
            {
                HandleRightMouseDrag();
            }
            else if (Input.GetMouseButtonUp(1))
            {
                HandleRightMouseUp();
            }

            if (Input.GetAxis("Mouse ScrollWheel") != 0 && _isDragging)
            {
                HandleScrollWheel();
            }

            _lastMousePosition = Input.mousePosition;
        }

        private void HandleLeftMouseDown()
        {
            float timeSinceLastClick = Time.time - _lastClickTime;

            if (_isDragging && timeSinceLastClick < _doubleClickTime)
            {
                AutoRotateToSnap();
                return;
            }

            _lastClickTime = Time.time;
            TryStartDrag();
        }

        private void HandleLeftMouseUp()
        {
            EndDrag();
        }

        private void HandleRightMouseDown()
        {
            if (_isDragging)
            {
                _isRotating = true;
                _dragStartRotation = _draggedPiece.transform.rotation;
            }
            else
            {
                TrySelectAndRotatePiece();
            }
        }

        private void HandleRightMouseDrag()
        {
            if (!_isRotating || _draggedPiece == null) return;

            float deltaX = Input.mousePosition.x - _lastMousePosition.x;
            float deltaY = Input.mousePosition.y - _lastMousePosition.y;

            float rotationSpeed = Input.GetKey(KeyCode.LeftShift) ? _rotationSpeed * 0.2f : _rotationSpeed;

            _draggedPiece.transform.Rotate(Vector3.up, deltaX * rotationSpeed * 0.01f, Space.World);
            _draggedPiece.transform.Rotate(Vector3.right, -deltaY * rotationSpeed * 0.01f, Space.World);

            if (_enableRotationSnap)
            {
                ApplyRotationSnap();
            }
        }

        private void HandleRightMouseUp()
        {
            _isRotating = false;
        }

        private void HandleScrollWheel()
        {
            if (_draggedPiece == null) return;

            float scrollDelta = Input.GetAxis("Mouse ScrollWheel");
            float scrollSpeed = Input.GetKey(KeyCode.LeftShift) ? 0.05f : 0.01f;

            _targetPosition.y += scrollDelta * scrollSpeed * 10f;
        }

        private void HandleKeyboardInput()
        {
            if (!_isDragging || _draggedPiece == null) return;

            float moveSpeed = Input.GetKey(KeyCode.LeftShift) ? 0.005f : 0.02f;

            if (Input.GetKey(KeyCode.W))
            {
                _targetPosition += Vector3.forward * moveSpeed;
            }
            if (Input.GetKey(KeyCode.S))
            {
                _targetPosition += Vector3.back * moveSpeed;
            }
            if (Input.GetKey(KeyCode.A))
            {
                _targetPosition += Vector3.left * moveSpeed;
            }
            if (Input.GetKey(KeyCode.D))
            {
                _targetPosition += Vector3.right * moveSpeed;
            }

            if (Input.GetKey(KeyCode.R))
            {
                float rotationAmount = Input.GetKey(KeyCode.LeftShift) ? 1f : 15f;
                _draggedPiece.transform.Rotate(Vector3.up, rotationAmount * Time.deltaTime * 10f, Space.World);
            }
        }

        private void TryStartDrag()
        {
            Ray ray = _mainCamera.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 100f, _pieceLayer))
            {
                var piece = hit.collider.GetComponentInParent<MortiseTenonPiece>();
                if (piece != null && !piece.IsPlaced)
                {
                    StartDrag(piece);
                }
            }
        }

        private void TrySelectAndRotatePiece()
        {
            Ray ray = _mainCamera.ScreenPointToRay(Input.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit, 100f, _pieceLayer))
            {
                var piece = hit.collider.GetComponentInParent<MortiseTenonPiece>();
                if (piece != null && !piece.IsPlaced)
                {
                    PieceManager.Instance.SelectPiece(piece);

                    float rotationAmount = Input.GetKey(KeyCode.LeftShift) ? 15f : 90f;
                    piece.transform.Rotate(Vector3.up, rotationAmount, Space.World);
                }
            }
        }

        private void StartDrag(MortiseTenonPiece piece)
        {
            _draggedPiece = piece;
            _isDragging = true;
            _hasMovedBeyondThreshold = false;
            _dragStartPosition = piece.transform.position;
            _dragStartRotation = piece.transform.rotation;

            _draggedPiece.StartDrag();
            PieceManager.Instance.SelectPiece(_draggedPiece);

            _dragPlane = new Plane(Vector3.up, _draggedPiece.transform.position);
            _targetPosition = piece.transform.position;
            _targetRotation = piece.transform.rotation;
            _velocity = Vector3.zero;
            _angularVelocity = Vector3.zero;
        }

        private void UpdateDragPosition()
        {
            Ray ray = _mainCamera.ScreenPointToRay(Input.mousePosition);
            if (_dragPlane.Raycast(ray, out float enter))
            {
                Vector3 newTargetPosition = ray.GetPoint(enter);

                float distanceMoved = Vector3.Distance(newTargetPosition, _dragStartPosition);
                if (distanceMoved > _dragThreshold)
                {
                    _hasMovedBeyondThreshold = true;
                }

                if (_hasMovedBeyondThreshold)
                {
                    _targetPosition = newTargetPosition;
                }

                if (_showConnectionPreview && _nearbyJoint != null)
                {
                    Vector3 snapPosition = _nearbyJoint.transform.position;
                    float distance = Vector3.Distance(_targetPosition, snapPosition);
                    if (distance < _previewSnapDistance)
                    {
                        _targetPosition = Vector3.Lerp(_targetPosition, snapPosition, _snapStrength);
                    }
                }

                if (_enablePositionSnap)
                {
                    ApplyPositionSnap();
                }

                if (_useSmoothDrag)
                {
                    Vector3 desiredVelocity = (_targetPosition - _draggedPiece.transform.position) * _dragSpeed;
                    _velocity = Vector3.Lerp(_velocity, desiredVelocity, 0.2f);
                    _velocity = Vector3.ClampMagnitude(_velocity, _maxDragVelocity);
                    _velocity *= _dragDamping;

                    _draggedPiece.transform.position += _velocity * Time.fixedDeltaTime;
                }
                else
                {
                    _draggedPiece.transform.position = _targetPosition;
                }
            }
        }

        private void UpdateDragRotation()
        {
            if (_nearbyJoint != null)
            {
                float angle = Quaternion.Angle(_draggedPiece.transform.rotation, _nearbyJoint.transform.rotation);
                if (angle < 30f)
                {
                    _draggedPiece.transform.rotation = Quaternion.Lerp(
                        _draggedPiece.transform.rotation,
                        _nearbyJoint.transform.rotation,
                        _snapStrength * Time.fixedDeltaTime * 5f
                    );
                }
            }
        }

        private void ApplyPositionSnap()
        {
            _targetPosition.x = Mathf.Round(_targetPosition.x / _positionSnapDistance) * _positionSnapDistance;
            _targetPosition.z = Mathf.Round(_targetPosition.z / _positionSnapDistance) * _positionSnapDistance;
        }

        private void ApplyRotationSnap()
        {
            Vector3 euler = _draggedPiece.transform.eulerAngles;
            euler.x = Mathf.Round(euler.x / _rotationSnapAngle) * _rotationSnapAngle;
            euler.y = Mathf.Round(euler.y / _rotationSnapAngle) * _rotationSnapAngle;
            euler.z = Mathf.Round(euler.z / _rotationSnapAngle) * _rotationSnapAngle;
            _draggedPiece.transform.eulerAngles = euler;
        }

        private void AutoRotateToSnap()
        {
            if (_nearbyJoint != null)
            {
                _draggedPiece.transform.rotation = _nearbyJoint.transform.rotation;
            }
            else
            {
                Vector3 euler = _draggedPiece.transform.eulerAngles;
                euler.y = Mathf.Round(euler.y / 90f) * 90f;
                _draggedPiece.transform.eulerAngles = euler;
            }
        }

        private void CheckNearbyJoints()
        {
            if (_draggedPiece == null) return;

            _nearbyJoint = null;
            float closestDistance = float.MaxValue;

            var joints = _draggedPiece.GetComponentsInChildren<MortiseTenonJoint>();
            foreach (var joint in joints)
            {
                var matchingJoint = PhysicsManager.Instance.FindBestMatchingJoint(joint, _checkConnectionRadius);
                if (matchingJoint != null)
                {
                    float distance = Vector3.Distance(joint.transform.position, matchingJoint.transform.position);
                    if (distance < closestDistance)
                    {
                        closestDistance = distance;
                        _nearbyJoint = matchingJoint;
                    }
                }
            }
        }

        private void PreventCollisions()
        {
            if (!_useCollisionPrevention || _draggedPiece == null) return;

            Collider[] colliders = Physics.OverlapBox(
                _draggedPiece.transform.position,
                _draggedPiece.transform.localScale * 0.5f,
                _draggedPiece.transform.rotation,
                Physics.AllLayers,
                QueryTriggerInteraction.Ignore
            );

            foreach (var collider in colliders)
            {
                if (collider.transform.IsChildOf(_draggedPiece.transform)) continue;
                if (collider.attachedRigidbody == _draggedPiece.Rigidbody) continue;

                if (Physics.ComputePenetration(
                    _draggedPiece.GetComponent<Collider>(),
                    _draggedPiece.transform.position,
                    _draggedPiece.transform.rotation,
                    collider,
                    collider.transform.position,
                    collider.transform.rotation,
                    out Vector3 direction,
                    out float distance
                ))
                {
                    if (distance > 0.001f)
                    {
                        Vector3 correction = direction * (distance + _collisionOffset);
                        _targetPosition += correction * 0.5f;
                    }
                }
            }
        }

        private void EndDrag()
        {
            if (_draggedPiece != null)
            {
                _draggedPiece.EndDrag();

                if (_autoConnectOnRelease)
                {
                    _draggedPiece.CheckAndCreateConnections(_checkConnectionRadius);
                }

                PieceManager.Instance.DeselectPiece();
            }

            _isDragging = false;
            _isRotating = false;
            _draggedPiece = null;
            _nearbyJoint = null;
            _velocity = Vector3.zero;
            _angularVelocity = Vector3.zero;
        }

        public void CancelDrag()
        {
            if (_isDragging && _draggedPiece != null)
            {
                _draggedPiece.EndDrag();
                PieceManager.Instance.DeselectPiece();
            }

            _isDragging = false;
            _isRotating = false;
            _draggedPiece = null;
            _nearbyJoint = null;
        }

        public void SetDragPlaneHeight(float height)
        {
            _dragPlane = new Plane(Vector3.up, new Vector3(0, height, 0));
        }

        public void MoveDraggedPieceUp(float amount)
        {
            if (_isDragging && _draggedPiece != null)
            {
                _targetPosition.y += amount;
            }
        }

        public void MoveDraggedPieceDown(float amount)
        {
            if (_isDragging && _draggedPiece != null)
            {
                _targetPosition.y -= amount;
            }
        }

        private void OnDrawGizmosSelected()
        {
            if (_isDragging && _draggedPiece != null)
            {
                Gizmos.color = Color.cyan;
                Gizmos.DrawWireSphere(_targetPosition, 0.05f);

                if (_nearbyJoint != null)
                {
                    Gizmos.color = Color.green;
                    Gizmos.DrawLine(_draggedPiece.transform.position, _nearbyJoint.transform.position);
                }
            }
        }
    }
}