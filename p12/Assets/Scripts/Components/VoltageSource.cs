using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class VoltageSource : CircuitElement, IVoltageSource
    {
        [SerializeField] private float sourceVoltage = 5f;
        [SerializeField] private float internalResistance = 0.1f;

        public float SourceVoltage
        {
            get => sourceVoltage;
            set => sourceVoltage = Mathf.Max(0f, value);
        }

        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f));
            nodes[1].IsGround = true;
        }

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 2) return;

            float conductance = 1f / internalResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                vector[idx0] += sourceVoltage * conductance;
                if (idx1 >= 0)
                {
                    matrix[idx0][idx1] -= conductance;
                }
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                vector[idx1] -= sourceVoltage * conductance;
                if (idx0 >= 0)
                {
                    matrix[idx1][idx0] -= conductance;
                }
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            voltage = nodes[0].Voltage - nodes[1].Voltage;
            current = (sourceVoltage - voltage) / internalResistance;
            power = current * sourceVoltage;
        }

        public override void UpdateState(float deltaTime)
        {
        }

        public float GetVoltage()
        {
            return sourceVoltage;
        }

        public CircuitNode GetPositiveNode()
        {
            return nodes.Count > 0 ? nodes[0] : null;
        }

        public CircuitNode GetNegativeNode()
        {
            return nodes.Count > 1 ? nodes[1] : null;
        }

        public int GetNodeCount()
        {
            return nodes.Count;
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "Voltage", sourceVoltage },
                { "InternalResistance", internalResistance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            switch (key)
            {
                case "Voltage":
                    SourceVoltage = (float)value;
                    break;
                case "InternalResistance":
                    internalResistance = Mathf.Max(0.001f, (float)value);
                    break;
            }
        }

        protected override void OnDrawGizmos()
        {
            base.OnDrawGizmos();
            Gizmos.color = Color.red;
            if (nodes.Count > 0)
                Gizmos.DrawWireSphere(nodes[0].Position, 0.1f);
            Gizmos.color = Color.blue;
            if (nodes.Count > 1)
                Gizmos.DrawWireSphere(nodes[1].Position, 0.1f);
        }
    }
}