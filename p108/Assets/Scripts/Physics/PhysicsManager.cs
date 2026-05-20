using UnityEngine;
using System.Collections.Generic;
using MortiseTenonGame.Core;

namespace MortiseTenonGame.Physics
{
    public class PhysicsManager : Singleton<PhysicsManager>
    {
        [Header("Global Physics Settings")]
        [SerializeField] private float _gravityMultiplier = 1.5f;
        [SerializeField] private float _maxAngularVelocity = 7f;
        [SerializeField] private float _contactOffset = 0.01f;
        [SerializeField] private float _defaultDrag = 0.1f;
        [SerializeField] private float _defaultAngularDrag = 0.1f;

        [Header("Collision Layers")]
        [SerializeField] private LayerMask _pieceLayer;
        [SerializeField] private LayerMask _groundLayer;
        [SerializeField] private LayerMask _targetZoneLayer;

        private List<PhysicsPiece> _activePieces = new List<PhysicsPiece>();
        private List<MortiseTenonJoint> _activeJoints = new List<MortiseTenonJoint>();

        protected override void Awake()
        {
            base.Awake();
            InitializePhysicsSettings();
        }

        private void InitializePhysicsSettings()
        {
            UnityEngine.Physics.gravity *= _gravityMultiplier;
            UnityEngine.Physics.maxAngularVelocity = _maxAngularVelocity;
            UnityEngine.Physics.defaultContactOffset = _contactOffset;
        }

        public void RegisterPiece(PhysicsPiece piece)
        {
            if (!_activePieces.Contains(piece))
            {
                _activePieces.Add(piece);
            }
        }

        public void UnregisterPiece(PhysicsPiece piece)
        {
            _activePieces.Remove(piece);
        }

        public void RegisterJoint(MortiseTenonJoint joint)
        {
            if (!_activeJoints.Contains(joint))
            {
                _activeJoints.Add(joint);
            }
        }

        public void UnregisterJoint(MortiseTenonJoint joint)
        {
            _activeJoints.Remove(joint);
        }

        public List<MortiseTenonJoint> FindNearbyJoints(MortiseTenonJoint sourceJoint, float maxDistance)
        {
            List<MortiseTenonJoint> nearbyJoints = new List<MortiseTenonJoint>();
            Vector3 sourcePosition = sourceJoint.JointWorldPosition;

            foreach (var joint in _activeJoints)
            {
                if (joint == sourceJoint) continue;
                if (joint.ParentPiece == sourceJoint.ParentPiece) continue;
                if (joint.IsConnected) continue;

                float distance = Vector3.Distance(sourcePosition, joint.JointWorldPosition);
                if (distance <= maxDistance)
                {
                    nearbyJoints.Add(joint);
                }
            }

            return nearbyJoints;
        }

        public MortiseTenonJoint FindBestMatchingJoint(MortiseTenonJoint sourceJoint, float maxDistance)
        {
            List<MortiseTenonJoint> nearbyJoints = FindNearbyJoints(sourceJoint, maxDistance);
            MortiseTenonJoint bestMatch = null;
            float bestScore = float.MaxValue;

            foreach (var joint in nearbyJoints)
            {
                if (!sourceJoint.CanConnect(joint)) continue;

                float distance = Vector3.Distance(sourceJoint.JointWorldPosition, joint.JointWorldPosition);
                float angle = Vector3.Angle(sourceJoint.JointWorldAxis, -joint.JointWorldAxis);
                float score = distance + angle * 0.01f;

                if (score < bestScore)
                {
                    bestScore = score;
                    bestMatch = joint;
                }
            }

            return bestMatch;
        }

        public List<PhysicsPiece> GetAllActivePieces()
        {
            return new List<PhysicsPiece>(_activePieces);
        }

        public void ResetAllPhysics()
        {
            foreach (var piece in _activePieces)
            {
                piece.ResetPiece();
            }
        }

        public void ApplyExplosion(Vector3 position, float force, float radius)
        {
            foreach (var piece in _activePieces)
            {
                float distance = Vector3.Distance(position, piece.transform.position);
                if (distance < radius)
                {
                    float falloff = 1f - (distance / radius);
                    Vector3 direction = (piece.transform.position - position).normalized;
                    piece.AddForce(direction * force * falloff, ForceMode.Impulse);
                }
            }
        }

        public bool CheckCollisionWithLayer(GameObject obj, LayerMask layer)
        {
            Collider[] colliders = Physics.OverlapBox(obj.transform.position, obj.transform.localScale * 0.5f,
                obj.transform.rotation, layer);
            return colliders.Length > 0;
        }

        public float CalculateStability()
        {
            if (_activePieces.Count == 0) return 1f;

            float totalStability = 0f;
            int connectedCount = 0;

            foreach (var joint in _activeJoints)
            {
                if (joint.IsConnected)
                {
                    connectedCount++;
                    totalStability += 1f;
                }
            }

            return _activeJoints.Count > 0 ? totalStability / _activeJoints.Count : 0f;
        }

        private void FixedUpdate()
        {
            foreach (var piece in _activePieces)
            {
                if (piece.Rigidbody && !piece.Rigidbody.isKinematic)
                {
                    ApplyDragForces(piece);
                }
            }
        }

        private void ApplyDragForces(PhysicsPiece piece)
        {
            if (piece.Rigidbody.velocity.magnitude > 0.01f)
            {
                Vector3 dragForce = -piece.Rigidbody.velocity.normalized *
                    piece.Rigidbody.velocity.sqrMagnitude * _defaultDrag;
                piece.AddForce(dragForce);
            }

            if (piece.Rigidbody.angularVelocity.magnitude > 0.01f)
            {
                Vector3 angularDragForce = -piece.Rigidbody.angularVelocity.normalized *
                    piece.Rigidbody.angularVelocity.sqrMagnitude * _defaultAngularDrag;
                piece.Rigidbody.AddTorque(angularDragForce);
            }
        }
    }
}