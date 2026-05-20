using UnityEngine;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.MortiseTenon
{
    public class MortiseTenonPiece : PhysicsPiece
    {
        [Header("Piece Info")]
        [SerializeField] private string _pieceId;
        [SerializeField] private PieceType _pieceType;
        [SerializeField] private PieceDifficulty _difficulty;
        [SerializeField] private WoodType _woodType;
        [SerializeField] private string _pieceName;
        [TextArea]
        [SerializeField] private string _pieceDescription;

        [Header("Visual Settings")]
        [SerializeField] private Material _defaultMaterial;
        [SerializeField] private Material _selectedMaterial;
        [SerializeField] private Material _connectedMaterial;

        [Header("Connection Settings")]
        [SerializeField] private int _requiredConnections = 1;

        private Renderer[] _renderers;
        private MortiseTenonJoint[] _joints;
        private bool _isSelected;

        public string PieceId => _pieceId;
        public PieceType PieceType => _pieceType;
        public PieceDifficulty Difficulty => _difficulty;
        public WoodType WoodType => _woodType;
        public string PieceName => _pieceName;
        public string PieceDescription => _pieceDescription;
        public MortiseTenonJoint[] Joints => _joints;
        public bool IsSelected => _isSelected;
        public int CurrentConnections
        {
            get
            {
                int count = 0;
                foreach (var joint in _joints)
                {
                    if (joint.IsConnected) count++;
                }
                return count;
            }
        }

        protected override void Awake()
        {
            base.Awake();
            _renderers = GetComponentsInChildren<Renderer>();
            _joints = GetComponentsInChildren<MortiseTenonJoint>();

            foreach (var joint in _joints)
            {
                PhysicsManager.Instance.RegisterJoint(joint);
            }

            PhysicsManager.Instance.RegisterPiece(this);
        }

        public void Select()
        {
            _isSelected = true;
            UpdateMaterial();
        }

        public void Deselect()
        {
            _isSelected = false;
            UpdateMaterial();
        }

        private void UpdateMaterial()
        {
            Material targetMaterial = _defaultMaterial;

            if (IsPlaced)
            {
                targetMaterial = _connectedMaterial;
            }
            else if (_isSelected)
            {
                targetMaterial = _selectedMaterial;
            }

            foreach (var renderer in _renderers)
            {
                renderer.material = targetMaterial;
            }
        }

        public override void PlacePiece()
        {
            base.PlacePiece();
            UpdateMaterial();
        }

        public bool IsFullyConnected()
        {
            return CurrentConnections >= _requiredConnections;
        }

        public float GetConnectionProgress()
        {
            return Mathf.Clamp01((float)CurrentConnections / _requiredConnections);
        }

        public void SnapToTarget(Vector3 targetPosition, Quaternion targetRotation)
        {
            transform.position = targetPosition;
            transform.rotation = targetRotation;
            Rigidbody.velocity = Vector3.zero;
            Rigidbody.angularVelocity = Vector3.zero;
        }

        public void CheckAndCreateConnections(float maxDistance = 0.1f)
        {
            foreach (var joint in _joints)
            {
                if (joint.IsConnected) continue;

                var bestJoint = PhysicsManager.Instance.FindBestMatchingJoint(joint, maxDistance);
                if (bestJoint != null)
                {
                    joint.TryConnect(bestJoint);
                }
            }
        }

        public void DisconnectAll()
        {
            foreach (var joint in _joints)
            {
                joint.DisconnectAll();
            }
        }

        private void OnDestroy()
        {
            foreach (var joint in _joints)
            {
                PhysicsManager.Instance.UnregisterJoint(joint);
            }
            PhysicsManager.Instance.UnregisterPiece(this);
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, 0.1f);
        }
    }
}