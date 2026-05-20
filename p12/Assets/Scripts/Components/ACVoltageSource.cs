using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class ACVoltageSource : CircuitElement
    {
        [SerializeField] private float amplitude = 5f;
        [SerializeField] private float frequency = 50f;
        [SerializeField] private float phase = 0f;
        [SerializeField] private float internalResistance = 0.1f;

        public float Amplitude
        {
            get => amplitude;
            set => amplitude = Mathf.Max(0f, value);
        }

        public float Frequency
        {
            get => frequency;
            set => frequency = Mathf.Max(0.01f, value);
        }

        public float Phase
        {
            get => phase;
            set => phase = value;
        }

        public float GetInstantaneousVoltage()
        {
            float omega = 2f * Mathf.PI * frequency;
            return amplitude * Mathf.Sin(omega * CircuitSimulator.SimulationTime + phase);
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

            float effResistance = GetEffectiveResistance(internalResistance);
            float conductance = 1f / effResistance;
            int idx0 = -1, idx1 = -1;

            if (nodeIndices.ContainsKey(nodes[0]))
                idx0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1]))
                idx1 = nodeIndices[nodes[1]];

            float instVoltage = GetInstantaneousVoltage();

            if (idx0 >= 0)
            {
                matrix[idx0][idx0] += conductance;
                vector[idx0] += instVoltage * conductance;
                if (idx1 >= 0)
                    matrix[idx0][idx1] -= conductance;
            }
            if (idx1 >= 0)
            {
                matrix[idx1][idx1] += conductance;
                vector[idx1] -= instVoltage * conductance;
                if (idx0 >= 0)
                    matrix[idx1][idx0] -= conductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            float effResistance = GetEffectiveResistance(internalResistance);
            voltage = nodes[0].Voltage - nodes[1].Voltage;
            float instVoltage = GetInstantaneousVoltage();
            current = (instVoltage - voltage) / effResistance;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "Amplitude", amplitude },
                { "Frequency", frequency },
                { "Phase", phase * Mathf.Rad2Deg }
            };
        }

        public override void SetParameter(string key, object value)
        {
            switch (key)
            {
                case "Amplitude":
                    Amplitude = (float)value;
                    break;
                case "Frequency":
                    Frequency = (float)value;
                    break;
                case "Phase":
                    Phase = (float)value * Mathf.Deg2Rad;
                    break;
            }
        }

        public override string GetStateDisplay()
        {
            float instVoltage = GetInstantaneousVoltage();
            return $"AC 电压源\n峰值: {amplitude:F1}V\n频率: {frequency:F1}Hz\n相位: {phase * Mathf.Rad2Deg:F0}°\n瞬时值: {instVoltage:F2}V\nI: {current:F3}A";
        }
    }
}