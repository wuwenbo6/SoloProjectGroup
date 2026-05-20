using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public abstract class LogicGate : CircuitElement
    {
        protected const float HIGH_VOLTAGE = 5f;
        protected const float LOW_VOLTAGE = 0f;
        protected const float THRESHOLD = 2.5f;
        protected const float PROPAGATION_DELAY = 0.001f;
        protected const float OUTPUT_RESISTANCE = 10f;

        protected float outputVoltage;
        protected float delayTimer;
        protected float nextOutputVoltage;

        protected LogicGate()
        {
            isDigitalElement = true;
        }

        protected bool IsInputHigh(CircuitNode node)
        {
            return node.Voltage >= THRESHOLD;
        }

        protected bool IsInputLow(CircuitNode node)
        {
            return node.Voltage < THRESHOLD;
        }

        protected abstract float CalculateOutput();

        public override void ApplyToMatrix(float[][] matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
            if (nodes.Count < 2) return;

            int outputIdx = nodes.Count - 1;
            float conductance = 1f / OUTPUT_RESISTANCE;
            int outIdx = -1;

            if (nodeIndices.ContainsKey(nodes[outputIdx]))
                outIdx = nodeIndices[nodes[outputIdx]];

            if (outIdx >= 0)
            {
                matrix[outIdx][outIdx] += conductance;
                vector[outIdx] += outputVoltage * conductance;
            }
        }

        public override void CalculateCurrent()
        {
            if (nodes.Count < 2) return;

            int outputIdx = nodes.Count - 1;
            voltage = nodes[outputIdx].Voltage - outputVoltage;
            current = (outputVoltage - nodes[outputIdx].Voltage) / OUTPUT_RESISTANCE;
            power = voltage * current;
        }

        public override void UpdateState(float deltaTime)
        {
            float newOutput = CalculateOutput();
            
            if (Mathf.Abs(newOutput - outputVoltage) > 0.1f)
            {
                delayTimer += deltaTime;
                if (delayTimer >= PROPAGATION_DELAY)
                {
                    outputVoltage = newOutput;
                    delayTimer = 0f;
                }
            }
            else
            {
                delayTimer = 0f;
            }
        }
    }
}