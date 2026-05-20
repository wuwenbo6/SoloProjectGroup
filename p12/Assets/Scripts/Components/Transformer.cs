using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class Transformer : CircuitElement
    {
        [SerializeField] private float turnsRatio = 2f;
        [SerializeField] private float primaryInductance = 0.1f;
        [SerializeField] private float primaryResistance = 0.1f;
        [SerializeField] private float secondaryResistance = 0.1f;
        [SerializeField] private float leakageInductance = 0.001f;

        private float primaryCurrent;
        private float secondaryCurrent;
        private float primaryLastCurrent;
        private float secondaryLastCurrent;
        private float primaryInternalVoltage;
        private float secondaryInternalVoltage;

        public float TurnsRatio
        {
            get => turnsRatio;
            set => turnsRatio = Mathf.Max(0.01f, value);
        }

        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f + Vector2.up * 0.3f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.3f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f + Vector2.down * 0.3f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.3f));
            
            primaryCurrent = 0f;
            secondaryCurrent = 0f;
            primaryLastCurrent = 0f;
            secondaryLastCurrent = 0f;
            primaryInternalVoltage = 0f;
            secondaryInternalVoltage = 0f;
        }

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 4) return;

            float priEffResistance = GetEffectiveResistance(primaryResistance);
            float secEffResistance = GetEffectiveResistance(secondaryResistance);
            
            float primaryConductance = 1f / priEffResistance;
            float secondaryConductance = 1f / secEffResistance;
            
            int p0 = -1, p1 = -1, s0 = -1, s1 = -1;

            if (nodeIndices.ContainsKey(nodes[0])) p0 = nodeIndices[nodes[0]];
            if (nodeIndices.ContainsKey(nodes[1])) p1 = nodeIndices[nodes[1]];
            if (nodeIndices.ContainsKey(nodes[2])) s0 = nodeIndices[nodes[2]];
            if (nodeIndices.ContainsKey(nodes[3])) s1 = nodeIndices[nodes[3]];

            if (p0 >= 0)
            {
                matrix[p0][p0] += primaryConductance;
                vector[p0] += primaryInternalVoltage * primaryConductance;
                if (p1 >= 0) matrix[p0][p1] -= primaryConductance;
            }
            if (p1 >= 0)
            {
                matrix[p1][p1] += primaryConductance;
                vector[p1] -= primaryInternalVoltage * primaryConductance;
                if (p0 >= 0) matrix[p1][p0] -= primaryConductance;
            }

            if (s0 >= 0)
            {
                matrix[s0][s0] += secondaryConductance;
                vector[s0] += secondaryInternalVoltage * secondaryConductance;
                if (s1 >= 0) matrix[s0][s1] -= secondaryConductance;
            }
            if (s1 >= 0)
            {
                matrix[s1][s1] += secondaryConductance;
                vector[s1] -= secondaryInternalVoltage * secondaryConductance;
                if (s0 >= 0) matrix[s1][s0] -= secondaryConductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 4) return;

            float priEffResistance = GetEffectiveResistance(primaryResistance);
            float secEffResistance = GetEffectiveResistance(secondaryResistance);

            float primaryVoltage = nodes[0].Voltage - nodes[1].Voltage;
            float secondaryVoltage = nodes[2].Voltage - nodes[3].Voltage;

            float reflectedResistance = turnsRatio * turnsRatio * secEffResistance;
            float totalPrimaryResistance = priEffResistance + reflectedResistance;
            
            float effectivePrimaryVoltage = primaryVoltage - primaryInternalVoltage + 
                                            (secondaryVoltage - secondaryInternalVoltage) / turnsRatio;
            
            primaryCurrent = effectivePrimaryVoltage / totalPrimaryResistance;
            secondaryCurrent = -primaryCurrent / turnsRatio;

            voltage = primaryVoltage;
            current = primaryCurrent;
            power = primaryVoltage * primaryCurrent;
        }

        public override void UpdateState(float deltaTime)
        {
            if (primaryInductance > 0f && deltaTime > 0f)
            {
                float diPrimary = primaryCurrent - primaryLastCurrent;
                float diSecondary = secondaryCurrent - secondaryLastCurrent;
                
                primaryInternalVoltage = (primaryInductance / deltaTime) * diPrimary +
                                         (primaryInductance * turnsRatio / deltaTime) * diSecondary;
                
                secondaryInternalVoltage = (primaryInductance * turnsRatio / deltaTime) * diPrimary +
                                           (primaryInductance * turnsRatio * turnsRatio / deltaTime) * diSecondary;

                primaryLastCurrent = primaryCurrent;
                secondaryLastCurrent = secondaryCurrent;
            }
        }

        public override Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>
            {
                { "TurnsRatio", turnsRatio },
                { "PrimaryInductance", primaryInductance },
                { "PrimaryResistance", primaryResistance },
                { "SecondaryResistance", secondaryResistance }
            };
        }

        public override void SetParameter(string key, object value)
        {
            switch (key)
            {
                case "TurnsRatio":
                    TurnsRatio = (float)value;
                    break;
                case "PrimaryInductance":
                    primaryInductance = Mathf.Max(0.0001f, (float)value);
                    break;
                case "PrimaryResistance":
                    primaryResistance = Mathf.Max(0.001f, (float)value);
                    break;
                case "SecondaryResistance":
                    secondaryResistance = Mathf.Max(0.001f, (float)value);
                    break;
            }
        }

        public override string GetStateDisplay()
        {
            float primaryVoltage = nodes.Count >= 2 ? nodes[0].Voltage - nodes[1].Voltage : 0f;
            float secondaryVoltage = nodes.Count >= 4 ? nodes[2].Voltage - nodes[3].Voltage : 0f;
            
            return $"变压器\n变比: 1:{turnsRatio:F1}\n初级电压: {primaryVoltage:F2}V\n初级电流: {primaryCurrent:F3}A\n" +
                   $"次级电压: {secondaryVoltage:F2}V\n次级电流: {secondaryCurrent:F3}A";
        }
    }
}