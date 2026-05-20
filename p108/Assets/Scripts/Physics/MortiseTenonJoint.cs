using UnityEngine;
using System.Collections.Generic;

namespace MortiseTenonGame.Physics
{
    public class MortiseTenonJoint : MonoBehaviour
    {
        [Header("Joint Settings")]
        [SerializeField] private JointType _jointType;
        [SerializeField] private Vector3 _jointOffset;
        [SerializeField] private Vector3 _jointAxis = Vector3.up;
        [SerializeField] private float _jointRadius = 0.05f;
        [SerializeField] private float _connectionForce = 500f;
        [SerializeField] private float _massScale = 10f;
        [SerializeField] private float _connectedMassScale = 10f;

        [Header("Snap Settings")]
        [SerializeField] private bool _enableSnap = true;
        [SerializeField] private float _snapDistance = 0.1f;
        [SerializeField] private float _snapAngle = 15f;

        [Header("Collision Prevention")]
        [SerializeField] private bool _disableCollisionBetweenConnected = true;
        [SerializeField] private float _collisionDisableDistance = 0.2f;

        private List<MortiseTenonJoint> _connectedJoints = new List<MortiseTenonJoint>();
        private FixedJoint _currentFixedJoint;
        private PhysicsPiece _parentPiece;
        private Collider[] _parentColliders;
        private bool _isDestroyed;

        public JointType JointType => _jointType;
        public Vector3 JointWorldPosition => transform.TransformPoint(_jointOffset);
        public Vector3 JointWorldAxis => transform.TransformDirection(_jointAxis);
        public PhysicsPiece ParentPiece => _parentPiece;
        public IReadOnlyList<MortiseTenonJoint> ConnectedJoints => _connectedJoints.AsReadOnly();
        public bool IsConnected => _connectedJoints.Count > 0;

        private void Awake()
        {
            _parentPiece = GetComponentInParent<PhysicsPiece>();
            if (_parentPiece != null)
            {
                _parentColliders = _parentPiece.GetComponentsInChildren<Collider>();
            }
        }

        private void OnDestroy()
        {
            _isDestroyed = true;
            SafeDisconnectAll();
        }

        public bool CanConnect(MortiseTenonJoint otherJoint)
        {
            if (otherJoint == null || otherJoint._isDestroyed) return false;
            if (otherJoint == this) return false;
            if (_connectedJoints.Contains(otherJoint)) return false;
            if (_parentPiece == null || otherJoint._parentPiece == null) return false;
            if (_parentPiece == otherJoint._parentPiece) return false;
            if (_parentPiece.IsPlaced && otherJoint._parentPiece.IsPlaced) return false;

            bool typeMatch = false;
            if (_jointType == JointType.Both || otherJoint._jointType == JointType.Both)
                typeMatch = true;
            else if (_jointType == JointType.Mortise && otherJoint._jointType == JointType.Tenon)
                typeMatch = true;
            else if (_jointType == JointType.Tenon && otherJoint._jointType == JointType.Mortise)
                typeMatch = true;

            if (!typeMatch) return false;

            float distance = Vector3.Distance(JointWorldPosition, otherJoint.JointWorldPosition);
            float angle = Vector3.Angle(JointWorldAxis, -otherJoint.JointWorldAxis);

            return distance < _snapDistance && angle < _snapAngle;
        }

        public ConnectionInfo TryConnect(MortiseTenonJoint otherJoint)
        {
            if (otherJoint == null || otherJoint._isDestroyed)
            {
                return new ConnectionInfo { Strength = ConnectionStrength.None, IsFullyConnected = false };
            }

            ConnectionInfo info = _parentPiece.CheckConnection(otherJoint._parentPiece);

            if (info.Strength >= ConnectionStrength.Medium)
            {
                Connect(otherJoint, info);
            }

            return info;
        }

        private void Connect(MortiseTenonJoint otherJoint, ConnectionInfo info)
        {
            if (otherJoint == null || otherJoint._isDestroyed) return;
            if (_connectedJoints.Contains(otherJoint)) return;

            try
            {
                if (_enableSnap && info.Strength == ConnectionStrength.Perfect)
                {
                    SnapToJoint(otherJoint);
                }

                CreateFixedJoint(otherJoint._parentPiece);

                _connectedJoints.Add(otherJoint);
                if (!otherJoint._connectedJoints.Contains(this))
                {
                    otherJoint._connectedJoints.Add(this);
                }

                if (_disableCollisionBetweenConnected)
                {
                    DisableCollisionBetweenPieces(_parentPiece, otherJoint._parentPiece);
                }

                _parentPiece.PlacePiece();
                otherJoint._parentPiece.PlacePiece();
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error connecting joints: {e.Message}");
                SafeDisconnectAll();
            }
        }

        private void SnapToJoint(MortiseTenonJoint targetJoint)
        {
            if (targetJoint == null || targetJoint._isDestroyed) return;

            Vector3 positionOffset = targetJoint.JointWorldPosition - JointWorldPosition;
            _parentPiece.transform.position += positionOffset;

            Quaternion targetRotation = Quaternion.FromToRotation(JointWorldAxis, -targetJoint.JointWorldAxis);
            _parentPiece.transform.rotation = targetRotation * _parentPiece.transform.rotation;
        }

        private void CreateFixedJoint(PhysicsPiece targetPiece)
        {
            if (targetPiece == null || targetPiece.Rigidbody == null) return;

            if (_currentFixedJoint != null)
            {
                DestroyImmediate(_currentFixedJoint);
                _currentFixedJoint = null;
            }

            _currentFixedJoint = _parentPiece.gameObject.AddComponent<FixedJoint>();
            _currentFixedJoint.connectedBody = targetPiece.Rigidbody;
            _currentFixedJoint.breakForce = _connectionForce;
            _currentFixedJoint.breakTorque = _connectionForce;
            _currentFixedJoint.enableCollision = !_disableCollisionBetweenConnected;
            _currentFixedJoint.enablePreprocessing = true;
            _currentFixedJoint.massScale = _massScale;
            _currentFixedJoint.connectedMassScale = _connectedMassScale;
        }

        private void DisableCollisionBetweenPieces(PhysicsPiece pieceA, PhysicsPiece pieceB)
        {
            if (pieceA == null || pieceB == null) return;

            Collider[] collidersA = pieceA.GetComponentsInChildren<Collider>();
            Collider[] collidersB = pieceB.GetComponentsInChildren<Collider>();

            foreach (var colA in collidersA)
            {
                if (colA == null || colA.isTrigger) continue;
                foreach (var colB in collidersB)
                {
                    if (colB == null || colB.isTrigger) continue;
                    Physics.IgnoreCollision(colA, colB, true);
                }
            }
        }

        private void EnableCollisionBetweenPieces(PhysicsPiece pieceA, PhysicsPiece pieceB)
        {
            if (pieceA == null || pieceB == null) return;

            Collider[] collidersA = pieceA.GetComponentsInChildren<Collider>();
            Collider[] collidersB = pieceB.GetComponentsInChildren<Collider>();

            foreach (var colA in collidersA)
            {
                if (colA == null || colA.isTrigger) continue;
                foreach (var colB in collidersB)
                {
                    if (colB == null || colB.isTrigger) continue;
                    Physics.IgnoreCollision(colA, colB, false);
                }
            }
        }

        public void DisconnectAll()
        {
            SafeDisconnectAll();
        }

        private void SafeDisconnectAll()
        {
            try
            {
                for (int i = _connectedJoints.Count - 1; i >= 0; i--)
                {
                    var joint = _connectedJoints[i];
                    if (joint != null && !joint._isDestroyed)
                    {
                        joint._connectedJoints.Remove(this);
                        if (_disableCollisionBetweenConnected)
                        {
                            EnableCollisionBetweenPieces(_parentPiece, joint._parentPiece);
                        }
                    }
                }
                _connectedJoints.Clear();

                if (_currentFixedJoint != null)
                {
                    DestroyImmediate(_currentFixedJoint);
                    _currentFixedJoint = null;
                }
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"Error during disconnection: {e.Message}");
            }
        }

        private void OnJointBreak(float breakForce)
        {
            Debug.Log($"Joint broke with force: {breakForce}");
            SafeDisconnectAll();
        }

        private void OnDrawGizmosSelected()
        {
            Vector3 worldPos = transform.TransformPoint(_jointOffset);
            Vector3 worldAxis = transform.TransformDirection(_jointAxis);

            Gizmos.color = _jointType == JointType.Mortise ? Color.red :
                           _jointType == JointType.Tenon ? Color.blue : Color.green;

            Gizmos.DrawWireSphere(worldPos, _jointRadius);
            Gizmos.DrawLine(worldPos, worldPos + worldAxis * _jointRadius * 2f);
        }
    }
}