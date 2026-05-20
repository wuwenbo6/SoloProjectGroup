using UnityEngine;
using System.Collections;
using MortiseTenonGame.MortiseTenon;
using MortiseTenonGame.Physics;

namespace MortiseTenonGame.UI
{
    public class HintAnimation : MonoBehaviour
    {
        [Header("Animation Settings")]
        [SerializeField] private float _pulseSpeed = 2f;
        [SerializeField] private float _pulseAmount = 0.1f;
        [SerializeField] private float _rotationSpeed = 30f;
        [SerializeField] private float _floatHeight = 0.05f;
        [SerializeField] private float _floatSpeed = 1f;

        [Header("Visual Settings")]
        [SerializeField] private Color _hintColor = new Color(0, 1, 0, 0.6f);
        [SerializeField] private Material _hintMaterial;
        [SerializeField] private GameObject _arrowPrefab;

        [Header("Target Settings")]
        [SerializeField] private float _showDistance = 0.5f;
        [SerializeField] private float _autoShowDelay = 10f;

        private MortiseTenonJoint _targetJoint;
        private GameObject _hintVisual;
        private Renderer[] _hintRenderers;
        private Coroutine _currentAnimation;
        private Coroutine _autoShowCoroutine;
        private Vector3 _originalPosition;
        private Quaternion _originalRotation;
        private bool _isShowing;

        public bool IsShowing => _isShowing;
        public MortiseTenonJoint TargetJoint => _targetJoint;

        private void Awake()
        {
            InitializeHintVisual();
        }

        private void InitializeHintVisual()
        {
            _hintVisual = new GameObject("HintVisual");
            _hintVisual.transform.SetParent(transform);
            _hintVisual.SetActive(false);

            var meshFilter = _hintVisual.AddComponent<MeshFilter>();
            var meshRenderer = _hintVisual.AddComponent<MeshRenderer>();

            meshFilter.mesh = CreateHintMesh();
            meshRenderer.material = _hintMaterial ?? CreateDefaultMaterial();

            _hintRenderers = new Renderer[] { meshRenderer };
        }

        private Mesh CreateHintMesh()
        {
            Mesh mesh = new Mesh();
            mesh.name = "HintMesh";

            Vector3[] vertices = new Vector3[]
            {
                new Vector3(-0.05f, 0, -0.05f),
                new Vector3(0.05f, 0, -0.05f),
                new Vector3(0.05f, 0, 0.05f),
                new Vector3(-0.05f, 0, 0.05f),
                new Vector3(0, 0.1f, 0)
            };

            int[] triangles = new int[]
            {
                0, 1, 4,
                1, 2, 4,
                2, 3, 4,
                3, 0, 4,
                0, 3, 2,
                2, 1, 0
            };

            Vector3[] normals = new Vector3[vertices.Length];
            for (int i = 0; i < normals.Length; i++)
            {
                normals[i] = Vector3.up;
            }

            mesh.vertices = vertices;
            mesh.triangles = triangles;
            mesh.normals = normals;
            mesh.RecalculateBounds();

            return mesh;
        }

        private Material CreateDefaultMaterial()
        {
            Material material = new Material(Shader.Find("Standard"));
            material.color = _hintColor;
            material.SetFloat("_Mode", 3);
            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            material.SetInt("_ZWrite", 0);
            material.DisableKeyword("_ALPHATEST_ON");
            material.EnableKeyword("_ALPHABLEND_ON");
            material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            material.renderQueue = 3000;
            return material;
        }

        public void ShowHint(MortiseTenonJoint targetJoint, HintType hintType = HintType.PositionAndRotation)
        {
            if (targetJoint == null) return;

            _targetJoint = targetJoint;
            _originalPosition = targetJoint.transform.position;
            _originalRotation = targetJoint.transform.rotation;

            _hintVisual.transform.position = _originalPosition;
            _hintVisual.transform.rotation = _originalRotation;
            _hintVisual.SetActive(true);
            _isShowing = true;

            if (_currentAnimation != null)
            {
                StopCoroutine(_currentAnimation);
            }

            _currentAnimation = StartCoroutine(PlayHintAnimation(hintType));
        }

        public void HideHint()
        {
            if (_currentAnimation != null)
            {
                StopCoroutine(_currentAnimation);
                _currentAnimation = null;
            }

            _hintVisual?.SetActive(false);
            _isShowing = false;
            _targetJoint = null;
        }

        private IEnumerator PlayHintAnimation(HintType hintType)
        {
            float time = 0;
            Vector3 startPos = _originalPosition;
            Quaternion startRot = _originalRotation;

            while (_isShowing)
            {
                time += Time.deltaTime;

                if ((hintType & HintType.Position) != 0)
                {
                    float yOffset = Mathf.Sin(time * _floatSpeed) * _floatHeight;
                    _hintVisual.transform.position = startPos + new Vector3(0, yOffset, 0);
                }

                if ((hintType & HintType.Rotation) != 0)
                {
                    _hintVisual.transform.Rotate(Vector3.up, _rotationSpeed * Time.deltaTime, Space.World);
                }

                if ((hintType & HintType.Pulse) != 0)
                {
                    float scale = 1 + Mathf.Sin(time * _pulseSpeed) * _pulseAmount;
                    _hintVisual.transform.localScale = Vector3.one * scale;
                }

                yield return null;
            }
        }

        public void StartAutoShowHint(MortiseTenonPiece piece)
        {
            if (_autoShowCoroutine != null)
            {
                StopCoroutine(_autoShowCoroutine);
            }

            _autoShowCoroutine = StartCoroutine(AutoShowHintRoutine(piece));
        }

        public void StopAutoShowHint()
        {
            if (_autoShowCoroutine != null)
            {
                StopCoroutine(_autoShowCoroutine);
                _autoShowCoroutine = null;
            }
            HideHint();
        }

        private IEnumerator AutoShowHintRoutine(MortiseTenonPiece piece)
        {
            yield return new WaitForSeconds(_autoShowDelay);

            while (piece != null && !piece.IsPlaced)
            {
                var joints = piece.GetComponentsInChildren<MortiseTenonJoint>();
                foreach (var joint in joints)
                {
                    if (!joint.IsConnected)
                    {
                        var nearbyJoint = FindNearbyConnectableJoint(joint);
                        if (nearbyJoint != null)
                        {
                            ShowHint(nearbyJoint);
                            yield return new WaitForSeconds(3f);
                            HideHint();
                            yield return new WaitForSeconds(5f);
                            break;
                        }
                    }
                }
                yield return new WaitForSeconds(1f);
            }
        }

        private MortiseTenonJoint FindNearbyConnectableJoint(MortiseTenonJoint sourceJoint)
        {
            var allJoints = FindObjectsOfType<MortiseTenonJoint>();
            foreach (var joint in allJoints)
            {
                if (joint == sourceJoint) continue;
                if (joint.ParentPiece == sourceJoint.ParentPiece) continue;
                if (joint.IsConnected) continue;

                float distance = Vector3.Distance(
                    sourceJoint.transform.position,
                    joint.transform.position
                );

                if (distance < _showDistance && sourceJoint.CanConnect(joint))
                {
                    return joint;
                }
            }
            return null;
        }

        public void ShowDirectionalHint(MortiseTenonJoint sourceJoint, MortiseTenonJoint targetJoint)
        {
            if (sourceJoint == null || targetJoint == null) return;

            HideHint();

            Vector3 direction = targetJoint.transform.position - sourceJoint.transform.position;
            float distance = direction.magnitude;

            if (distance < 0.1f)
            {
                ShowHint(targetJoint, HintType.Rotation | HintType.Pulse);
            }
            else
            {
                _hintVisual.transform.position = sourceJoint.transform.position;
                _hintVisual.transform.rotation = Quaternion.LookRotation(direction.normalized);
                _hintVisual.SetActive(true);
                _isShowing = true;

                if (_currentAnimation != null)
                {
                    StopCoroutine(_currentAnimation);
                }

                _currentAnimation = StartCoroutine(PlayDirectionalAnimation(direction));
            }
        }

        private IEnumerator PlayDirectionalAnimation(Vector3 direction)
        {
            float time = 0;
            Vector3 startPos = _hintVisual.transform.position;

            while (_isShowing)
            {
                time += Time.deltaTime;
                float progress = (Mathf.Sin(time * 2f) + 1) / 2;
                _hintVisual.transform.position = startPos + direction.normalized * progress * 0.1f;
                _hintVisual.transform.localScale = Vector3.one * (1 + progress * 0.2f);
                yield return null;
            }
        }

        private void OnDestroy()
        {
            HideHint();
            StopAutoShowHint();
        }
    }

    public enum HintType
    {
        Position = 1 << 0,
        Rotation = 1 << 1,
        Pulse = 1 << 2,
        PositionAndRotation = Position | Rotation,
        All = Position | Rotation | Pulse
    }
}