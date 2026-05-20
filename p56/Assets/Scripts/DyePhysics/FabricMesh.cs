using UnityEngine;

namespace TieDyeGame.DyePhysics
{
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public class FabricMesh : MonoBehaviour
    {
        [Header("布料设置")]
        public int resolution = 100;
        public float size = 2f;
        public bool use3D = false;

        private Mesh fabricMesh;
        private MeshRenderer meshRenderer;
        private DyeSimulation dyeSimulation;

        private void Start()
        {
            InitializeFabric();
        }

        public void InitializeFabric()
        {
            fabricMesh = new Mesh();
            fabricMesh.name = "FabricMesh";

            GetComponent<MeshFilter>().mesh = fabricMesh;
            meshRenderer = GetComponent<MeshRenderer>();

            if (use3D)
            {
                Generate3DMesh();
            }
            else
            {
                Generate2DMesh();
            }

            SetupMaterial();
        }

        private void Generate2DMesh()
        {
            int vertCount = (resolution + 1) * (resolution + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector2[] uv = new Vector2[vertCount];
            int[] triangles = new int[resolution * resolution * 6];

            float halfSize = size * 0.5f;
            float step = size / resolution;

            for (int y = 0; y <= resolution; y++)
            {
                for (int x = 0; x <= resolution; x++)
                {
                    int index = y * (resolution + 1) + x;
                    vertices[index] = new Vector3(-halfSize + x * step, -halfSize + y * step, 0);
                    uv[index] = new Vector2((float)x / resolution, (float)y / resolution);
                }
            }

            int triIndex = 0;
            for (int y = 0; y < resolution; y++)
            {
                for (int x = 0; x < resolution; x++)
                {
                    int bottomLeft = y * (resolution + 1) + x;
                    int bottomRight = bottomLeft + 1;
                    int topLeft = (y + 1) * (resolution + 1) + x;
                    int topRight = topLeft + 1;

                    triangles[triIndex++] = bottomLeft;
                    triangles[triIndex++] = topLeft;
                    triangles[triIndex++] = bottomRight;
                    triangles[triIndex++] = bottomRight;
                    triangles[triIndex++] = topLeft;
                    triangles[triIndex++] = topRight;
                }
            }

            fabricMesh.vertices = vertices;
            fabricMesh.uv = uv;
            fabricMesh.triangles = triangles;
            fabricMesh.RecalculateNormals();
        }

        private void Generate3DMesh()
        {
            int vertCount = (resolution + 1) * (resolution + 1);
            Vector3[] vertices = new Vector3[vertCount];
            Vector2[] uv = new Vector2[vertCount];
            int[] triangles = new int[resolution * resolution * 6];

            float halfSize = size * 0.5f;
            float step = size / resolution;

            for (int y = 0; y <= resolution; y++)
            {
                for (int x = 0; x <= resolution; x++)
                {
                    int index = y * (resolution + 1) + x;
                    float nx = (float)x / resolution;
                    float ny = (float)y / resolution;

                    float waveX = Mathf.Sin(nx * Mathf.PI * 2) * 0.1f;
                    float waveY = Mathf.Cos(ny * Mathf.PI * 2) * 0.1f;

                    vertices[index] = new Vector3(-halfSize + x * step, waveX + waveY, -halfSize + y * step);
                    uv[index] = new Vector2(nx, ny);
                }
            }

            int triIndex = 0;
            for (int y = 0; y < resolution; y++)
            {
                for (int x = 0; x < resolution; x++)
                {
                    int bottomLeft = y * (resolution + 1) + x;
                    int bottomRight = bottomLeft + 1;
                    int topLeft = (y + 1) * (resolution + 1) + x;
                    int topRight = topLeft + 1;

                    triangles[triIndex++] = bottomLeft;
                    triangles[triIndex++] = topLeft;
                    triangles[triIndex++] = bottomRight;
                    triangles[triIndex++] = bottomRight;
                    triangles[triIndex++] = topLeft;
                    triangles[triIndex++] = topRight;
                }
            }

            fabricMesh.vertices = vertices;
            fabricMesh.uv = uv;
            fabricMesh.triangles = triangles;
            fabricMesh.RecalculateNormals();
        }

        private void SetupMaterial()
        {
            Material fabricMaterial = new Material(Shader.Find("Standard"));
            fabricMaterial.color = Color.white;
            meshRenderer.material = fabricMaterial;
        }

        public void SetDyeSimulation(DyeSimulation simulation)
        {
            dyeSimulation = simulation;
            dyeSimulation.OnTextureUpdated += UpdateTexture;
        }

        private void UpdateTexture(Texture2D texture)
        {
            if (meshRenderer != null)
            {
                meshRenderer.material.mainTexture = texture;
            }
        }

        public Vector2 GetUVFromWorldPosition(Vector3 worldPos)
        {
            Vector3 localPos = transform.InverseTransformPoint(worldPos);
            float halfSize = size * 0.5f;
            float u = Mathf.InverseLerp(-halfSize, halfSize, localPos.x);
            float v = Mathf.InverseLerp(-halfSize, halfSize, localPos.y);
            return new Vector2(Mathf.Clamp01(u), Mathf.Clamp01(v));
        }

        private void OnDestroy()
        {
            if (dyeSimulation != null)
            {
                dyeSimulation.OnTextureUpdated -= UpdateTexture;
            }
        }
    }
}
