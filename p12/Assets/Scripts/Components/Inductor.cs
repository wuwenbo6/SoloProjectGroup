using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Inductor : CircuitElement
    {
        [SerializeField] private float inductance = 0.01f;
        [SerializeField] private float seriesResistance = 0.01f;
        private float lastCurrent;
        private float internalVoltage;

        public float Inductance
        {
            get => inductance;
            set => inductance = Mathf.Max(0.00001f, value);
        }

        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f));
            lastCurrent = 0f;
            internalVoltage = 0f;
        }

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 2) return;

            float effResistance = GetEffectiveResistance(seriesResistance);
            float conductance = 1f / effResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                vector[idx0] += internalVoltage * conductance;
                if (idx1 >= 0)
                    matrix[idx0][idx1] -= conductance;
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                vector[idx1] -= internalVoltage * conductance;
                if (idx0 >= 0)
                    matrix[idx1][idx0] -= conductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            float effResistance = GetEffectiveResistance(seriesResistance);
            voltage = nodes[0].Voltage - nodes[1].Voltage;
            float effectiveVoltage = voltage - internalVoltage;
            current = effectiveVoltage / effResistance;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
            if (inductance > 0f && deltaTime > 0f)
            {
                float voltageAcross = voltage;
                internalVoltage = (inductance / deltaTime) * (current - lastCurrent);
                lastCurrent = current;
            }
        }

        public float GetReactance(float frequency)
        {
            return 2f * Mathf.PI * frequency * inductance;
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "Inductance", inductance },
                { "Resistance", seriesResistance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            switch (key)
            {
                case "Inductance":
                    Inductance = (float)value;
                    break;
                case "Resistance":
                    seriesResistance = Mathf.Max(0.001f, (float)value);
                    break;
            }
        }

        public override string GetStateDisplay()
        {
            float reactance50 = GetReactance(50f);
            return $"电感\nL: {inductance:F4}H\nR: {seriesResistance:F3}Ω\nX(50Hz): {reactance50:F2}Ω\nI: {current:F3}A\nV: {voltage:F2}V";
        }
    }
}