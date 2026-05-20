using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Resistor : CircuitElement
    {
        [SerializeField] private float resistance = 100f;

        public float Resistance
        {
            get => resistance;
            set => resistance = Mathf.Max(0.001f, value);
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

            float effResistance = GetEffectiveResistance(resistance);
            voltage = nodes[0].Voltage - nodes[1].Voltage;
            current = voltage / effResistance;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
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
            return $"R: {resistance:F1}Ω\nI: {current:F3}A\nV: {voltage:F2}V\nP: {power:F3}W";
        }

        protected void OnDrawGizmos()
        {
            Gizmos.color = Color.yellow;
            foreach (var node in nodes)
            {
                Gizmos.DrawWireSphere(node.Position, 0.1f);
            }
        }
    }
}