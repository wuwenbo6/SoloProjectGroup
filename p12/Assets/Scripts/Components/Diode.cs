using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Diode : CircuitElement
    {
        [SerializeField] private float forwardVoltageDrop = 0.7f;
        [SerializeField] private float reverseResistance = 1000000f;
        [SerializeField] private float forwardResistance = 1f;

        private bool isForwardBiased;

        public float ForwardVoltageDrop
        {
            get => forwardVoltageDrop;
            set => forwardVoltageDrop = Mathf.Max(0f, value);
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

            float effectiveResistance = isForwardBiased ? forwardResistance : reverseResistance;
            float conductance = 1f / effectiveResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            float voltageSource = isForwardBiased ? forwardVoltageDrop : 0f;

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                vector[idx0] += voltageSource * conductance;
                if (idx1 >= 0)
                    matrix[idx0][idx1] -= conductance;
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                vector[idx1] -= voltageSource * conductance;
                if (idx0 >= 0)
                    matrix[idx1][idx0] -= conductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            voltage = nodes[0].Voltage - nodes[1].Voltage;
            isForwardBiased = voltage > forwardVoltageDrop;

            float effectiveResistance = isForwardBiased ? forwardResistance : reverseResistance;
            float effectiveVoltage = isForwardBiased ? voltage - forwardVoltageDrop : voltage;
            current = effectiveVoltage / effectiveResistance;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "ForwardVoltageDrop", forwardVoltageDrop },
                { "ReverseResistance", reverseResistance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            switch (key)
            {
                case "ForwardVoltageDrop":
                    ForwardVoltageDrop = (float)value;
                    break;
                case "ReverseResistance":
                    reverseResistance = Mathf.Max(1000f, (float)value);
                    break;
            }
        }

        public override string GetStateDisplay()
        {
            string state = isForwardBiased ? "导通" : "截止";
            return $"状态: {state}\nVf: {forwardVoltageDrop:F2}V\nI: {current:F6}A\nV: {voltage:F2}V";
        }

        protected void OnDrawGizmos()
        {
            Gizmos.color = isForwardBiased ? Color.green : Color.gray;
            foreach (var node in nodes)
            {
                Gizmos.DrawWireSphere(node.Position, 0.1f);
            }
        }
    }
}