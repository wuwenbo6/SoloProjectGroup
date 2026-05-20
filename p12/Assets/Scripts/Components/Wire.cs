using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Wire : CircuitElement
    {
        [SerializeField] private float resistance = 0.001f;
        private LineRenderer lineRenderer;

        public float Resistance
        {
            get => resistance;
            set => resistance = Mathf.Max(0.0001f, value);
        }

        protected override void Awake()
        {
            base.Awake();
            lineRenderer = GetComponent<LineRenderer>();
            if (lineRenderer == null)
            {
                lineRenderer = gameObject.AddComponent<LineRenderer>();
                lineRenderer.startWidth = 0.05f;
                lineRenderer.endWidth = 0.05f;
                lineRenderer.material = new Material(Shader.Find("Sprites/Default"));
            }
        }

        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f));
        }

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 2) return;

            float effResistance = GetEffectiveResistance(resistance);
            float conductance = 1f / effResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                if (idx1 >= 0)
                    matrix[idx0][idx1] -= conductance;
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                if (idx0 >= 0)
                    matrix[idx1][idx0] -= conductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            voltage = nodes[0].Voltage - nodes[1].Voltage;
            current = voltage / resistance;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
            UpdateWireVisual();
        }

        private void UpdateWireVisual()
        {
            if (lineRenderer != null && nodes.Count >= 2)
            {
                lineRenderer.SetPosition(0, nodes[0].Position);
                lineRenderer.SetPosition(1, nodes[1].Position);

                float currentMagnitude = Mathf.Abs(current);
                float colorIntensity = Mathf.Min(1f, currentMagnitude * 20f);
                lineRenderer.startColor = Color.Lerp(Color.gray, Color.cyan, colorIntensity);
                lineRenderer.endColor = lineRenderer.startColor;
            }
        }

        public void SetEndpoints(Vector2 start, Vector2 end)
        {
            transform.position = (start + end) / 2f;
            nodes[0] = new CircuitNode(start);
            nodes[1] = new CircuitNode(end);

            if (lineRenderer != null)
            {
                lineRenderer.SetPosition(0, start);
                lineRenderer.SetPosition(1, end);
            }
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "Resistance", resistance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            if (key == "Resistance")
            {
                Resistance = (float)value;
            }
        }

        public override string GetStateDisplay()
        {
            return $"I: {current:F4}A\nV: {voltage:F4}V\nR: {resistance:F4}Ω";
        }
    }
}