using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Capacitor : CircuitElement
    {
        [SerializeField] private float capacitance = 0.001f;
        private float storedCharge;
        private float voltageAcross;
        private const float seriesResistance = 0.1f;

        public float Capacitance
        {
            get => capacitance;
            set => capacitance = Mathf.Max(0.000001f, value);
        }

        public float StoredCharge => storedCharge;
        public float VoltageAcross => voltageAcross;

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 2) return;

            float effectiveResistance = seriesResistance;
            float conductance = 1f / effectiveResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                vector[idx0] += voltageAcross * conductance;
                if (idx1 >= 0)
                    matrix[idx0][idx1] -= conductance;
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                vector[idx1] -= voltageAcross * conductance;
                if (idx0 >= 0)
                    matrix[idx1][idx0] -= conductance;
            }
        }

        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f));
            storedCharge = 0f;
            voltageAcross = 0f;
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            float nodeVoltageDiff = nodes[0].Voltage - nodes[1].Voltage;
            voltage = nodeVoltageDiff;
            
            float effectiveResistance = seriesResistance;
            if (capacitance > 0f)
            {
                float timeConstant = effectiveResistance * capacitance;
                if (timeConstant > 0f)
                {
                    float targetVoltage = nodeVoltageDiff;
                    float voltageError = targetVoltage - voltageAcross;
                    current = voltageError / effectiveResistance;
                }
                else
                {
                    current = 0f;
                }
            }
            else
            {
                current = nodeVoltageDiff / effectiveResistance;
            }

            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
            if (capacitance <= 0f) return;

            float timeConstant = seriesResistance * capacitance;
            float alpha = deltaTime / (timeConstant + deltaTime);
            float targetVoltage = voltage;
            
            voltageAcross = Mathf.Lerp(voltageAcross, targetVoltage, alpha);
            storedCharge = voltageAcross * capacitance;

            float voltageError = targetVoltage - voltageAcross;
            current = voltageError / seriesResistance;
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "Capacitance", capacitance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            if (key == "Capacitance")
            {
                Capacitance = (float)value;
            }
        }

        public override string GetStateDisplay()
        {
            return $"C: {capacitance:F4}F\nQ: {storedCharge:F4}C\nVc: {voltageAcross:F2}V\nI: {current:F3}A\nτ: {seriesResistance * capacitance:F4}s";
        }

        protected void OnDrawGizmos()
        {
            Gizmos.color = Color.magenta;
            foreach (var node in nodes)
            {
                Gizmos.DrawWireSphere(node.Position, 0.1f);
            }
        }
    }
}