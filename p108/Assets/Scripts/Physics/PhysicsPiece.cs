using UnityEngine;

namespace MortiseTenonGame.Physics
{
    [RequireComponent(typeof(Rigidbody), typeof(Collider))]
    public class PhysicsPiece : MonoBehaviour
    {
        [Header("Physics Settings")]
        [SerializeField] private float _mass = 1f;
        [SerializeField] private float _drag = 0.5f;
        [SerializeField] private float _angularDrag = 0.5f;
        [SerializeField] private bool _useGravity = true;
        [SerializeField] private bool _isKinematicWhenPlaced = true;
        [SerializeField] private float _maxVelocity = 10f;
        [SerializeField] private float _maxAngularVelocity = 7f;

        [Header("Connection Settings")]
        [SerializeField] private float _connectionThreshold = 0.1f;
        [SerializeField] private float _perfectConnectionThreshold = 0.02f;

        [Header("Collision Prevention")]
        [SerializeField] private float _skinWidth = 0.01f;
        [SerializeField] private bool _enableContinuousCollision = true;

        private Rigidbody _rigidbody;
        private Collider _collider;
        private bool _isBeingDragged;
        private bool _isPlaced;
        private Vector3 _lastValidPosition;
        private Quaternion _lastValidRotation;

        public Rigidbody Rigidbody => _rigidbody;
        public bool IsBeingDragged => _isBeingDragged;
        public bool IsPlaced => _isPlaced;

        protected virtual void Awake()
        {
            _rigidbody = GetComponent<Rigidbody>();
            _collider = GetComponent<Collider>();

            SetupRigidbody();
            SetupCollider();
            _lastValidPosition = transform.position;
            _lastValidRotation = transform.rotation;
        }

        private void SetupRigidbody()
        {
            _rigidbody.mass = _mass;
            _rigidbody.drag = _drag;
            _rigidbody.angularDrag = _angularDrag;
            _rigidbody.useGravity = _useGravity;
            _rigidbody.isKinematic = false;
            _rigidbody.interpolation = RigidbodyInterpolation.Interpolate;
            _rigidbody.collisionDetectionMode = _enableContinuousCollision 
                ? CollisionDetectionMode.ContinuousDynamic 
                : CollisionDetectionMode.Discrete;
            _rigidbody.maxDepenetrationVelocity = 5f;
            _rigidbody.sleepThreshold = 0.005f;
        }

        private void SetupCollider()
        {
            if (_collider is BoxCollider boxCollider)
            {
                boxCollider.contactOffset = _skinWidth;
                boxCollider.isTrigger = false;
            }
            else if (_collider is CapsuleCollider capsuleCollider)
            {
                capsuleCollider.contactOffset = _skinWidth;
                capsuleCollider.isTrigger = false;
            }
            else if (_collider is SphereCollider sphereCollider)
            {
                sphereCollider.contactOffset = _skinWidth;
                sphereCollider.isTrigger = false;
            }
            else if (_collider is MeshCollider meshCollider)
            {
                meshCollider.contactOffset = _skinWidth;
                meshCollider.isTrigger = false;
                meshCollider.convex = true;
            }
        }

        public virtual void StartDrag()
        {
            _isBeingDragged = true;
            _rigidbody.isKinematic = true;
            _rigidbody.useGravity = false;
            _rigidbody.velocity = Vector3.zero;
            _rigidbody.angularVelocity = Vector3.zero;
        }

        public virtual void EndDrag()
        {
            _isBeingDragged = false;
            _rigidbody.isKinematic = false;
            _rigidbody.useGravity = _useGravity;
            _rigidbody.velocity = Vector3.ClampMagnitude(_rigidbody.velocity, _maxVelocity);
            _rigidbody.angularVelocity = Vector3.ClampMagnitude(_rigidbody.angularVelocity, _maxAngularVelocity);
        }

        public virtual void PlacePiece()
        {
            if (_isKinematicWhenPlaced)
            {
                _rigidbody.isKinematic = true;
                _rigidbody.useGravity = false;
                _rigidbody.velocity = Vector3.zero;
                _rigidbody.angularVelocity = Vector3.zero;
            }
            _isPlaced = true;
        }

        public virtual void ResetPiece()
        {
            _isPlaced = false;
            _isBeingDragged = false;
            SetupRigidbody();
            _rigidbody.velocity = Vector3.zero;
            _rigidbody.angularVelocity = Vector3.zero;
        }

        public void SetVelocity(Vector3 velocity)
        {
            if (!_rigidbody.isKinematic)
            {
                _rigidbody.velocity = Vector3.ClampMagnitude(velocity, _maxVelocity);
            }
        }

        public void AddForce(Vector3 force, ForceMode mode = ForceMode.Force)
        {
            if (!_rigidbody.isKinematic)
            {
                _rigidbody.AddForce(force, mode);
                _rigidbody.velocity = Vector3.ClampMagnitude(_rigidbody.velocity, _maxVelocity);
            }
        }

        private void FixedUpdate()
        {
            PreventPenetration();
            ClampVelocities();
        }

        private void PreventPenetration()
        {
            if (_isBeingDragged || _isPlaced) return;

            Collider[] overlaps = Physics.OverlapBox(
                transform.TransformPoint(_collider.bounds.center),
                _collider.bounds.extents * 0.95f,
                transform.rotation,
                Physics.AllLayers,
                QueryTriggerInteraction.Ignore
            );

            foreach (var overlap in overlaps)
            {
                if (overlap == _collider) continue;
                if (overlap.attachedRigidbody == _rigidbody) continue;

                if (Physics.ComputePenetration(
                    _collider, transform.position, transform.rotation,
                    overlap, overlap.transform.position, overlap.transform.rotation,
                    out Vector3 direction, out float distance
                ))
                {
                    if (distance > 0.001f)
                    {
                        Vector3 correction = direction * distance * 1.05f;
                        _rigidbody.position += correction;
                        _rigidbody.velocity -= Vector3.Project(_rigidbody.velocity, direction) * 0.8f;
                    }
                }
            }
        }

        private void ClampVelocities()
        {
            if (_rigidbody.velocity.magnitude > _maxVelocity)
            {
                _rigidbody.velocity = _rigidbody.velocity.normalized * _maxVelocity;
            }

            if (_rigidbody.angularVelocity.magnitude > _maxAngularVelocity)
            {
                _rigidbody.angularVelocity = _rigidbody.angularVelocity.normalized * _maxAngularVelocity;
            }
        }

        private void OnCollisionStay(Collision collision)
        {
            if (_isBeingDragged || _isPlaced) return;

            foreach (ContactPoint contact in collision.contacts)
            {
                if (contact.separation < -0.001f)
                {
                    Vector3 correction = contact.normal * Mathf.Abs(contact.separation) * 1.1f;
                    _rigidbody.position += correction;
                    _rigidbody.velocity -= Vector3.Project(_rigidbody.velocity, contact.normal) * 0.5f;
                }
            }
        }

        public ConnectionInfo CheckConnection(PhysicsPiece otherPiece)
        {
            ConnectionInfo info = new ConnectionInfo();

            float distance = Vector3.Distance(transform.position, otherPiece.transform.position);
            float angle = Quaternion.Angle(transform.rotation, otherPiece.transform.rotation);

            info.AlignmentError = distance + angle * 0.01f;
            info.InsertionDepth = Mathf.Clamp01(1f - (distance / _connectionThreshold));

            if (info.AlignmentError < _perfectConnectionThreshold)
            {
                info.Strength = ConnectionStrength.Perfect;
                info.IsFullyConnected = true;
            }
            else if (info.AlignmentError < _connectionThreshold * 0.5f)
            {
                info.Strength = ConnectionStrength.Strong;
                info.IsFullyConnected = true;
            }
            else if (info.AlignmentError < _connectionThreshold)
            {
                info.Strength = ConnectionStrength.Medium;
                info.IsFullyConnected = false;
            }
            else if (info.AlignmentError < _connectionThreshold * 2f)
            {
                info.Strength = ConnectionStrength.Weak;
                info.IsFullyConnected = false;
            }
            else
            {
                info.Strength = ConnectionStrength.None;
                info.IsFullyConnected = false;
            }

            return info;
        }
    }
}