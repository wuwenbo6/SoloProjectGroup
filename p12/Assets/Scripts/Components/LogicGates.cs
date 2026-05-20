using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.Components
{
    public class NotGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = HIGH_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 2) return LOW_VOLTAGE;
            bool inputHigh = IsInputHigh(nodes[0]);
            return inputHigh ? LOW_VOLTAGE : HIGH_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool input = IsInputHigh(nodes[0]);
            bool output = outputVoltage >= THRESHOLD;
            return $"非门 (NOT)\n输入: {(input ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }

    public class AndGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = LOW_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 3) return LOW_VOLTAGE;
            bool inputAHigh = IsInputHigh(nodes[0]);
            bool inputBHigh = IsInputHigh(nodes[1]);
            return (inputAHigh && inputBHigh) ? HIGH_VOLTAGE : LOW_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool a = nodes.Count >= 1 && IsInputHigh(nodes[0]);
            bool b = nodes.Count >= 2 && IsInputHigh(nodes[1]);
            bool output = outputVoltage >= THRESHOLD;
            return $"与门 (AND)\nA: {(a ? "高" : "低")}\nB: {(b ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }

    public class OrGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = LOW_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 3) return LOW_VOLTAGE;
            bool inputAHigh = IsInputHigh(nodes[0]);
            bool inputBHigh = IsInputHigh(nodes[1]);
            return (inputAHigh || inputBHigh) ? HIGH_VOLTAGE : LOW_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool a = nodes.Count >= 1 && IsInputHigh(nodes[0]);
            bool b = nodes.Count >= 2 && IsInputHigh(nodes[1]);
            bool output = outputVoltage >= THRESHOLD;
            return $"或门 (OR)\nA: {(a ? "高" : "低")}\nB: {(b ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }

    public class NandGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = HIGH_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 3) return HIGH_VOLTAGE;
            bool inputAHigh = IsInputHigh(nodes[0]);
            bool inputBHigh = IsInputHigh(nodes[1]);
            return !(inputAHigh && inputBHigh) ? HIGH_VOLTAGE : LOW_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool a = nodes.Count >= 1 && IsInputHigh(nodes[0]);
            bool b = nodes.Count >= 2 && IsInputHigh(nodes[1]);
            bool output = outputVoltage >= THRESHOLD;
            return $"与非门 (NAND)\nA: {(a ? "高" : "低")}\nB: {(b ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }

    public class NorGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = HIGH_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 3) return HIGH_VOLTAGE;
            bool inputAHigh = IsInputHigh(nodes[0]);
            bool inputBHigh = IsInputHigh(nodes[1]);
            return !(inputAHigh || inputBHigh) ? HIGH_VOLTAGE : LOW_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool a = nodes.Count >= 1 && IsInputHigh(nodes[0]);
            bool b = nodes.Count >= 2 && IsInputHigh(nodes[1]);
            bool output = outputVoltage >= THRESHOLD;
            return $"或非门 (NOR)\nA: {(a ? "高" : "低")}\nB: {(b ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }

    public class XorGate : LogicGate
    {
        protected override void InitializeNodes()
        {
            nodes.Clear();
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.up * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.left * 0.5f + Vector2.down * 0.2f));
            nodes.Add(new CircuitNode((Vector2)transform.position + Vector2.right * 0.5f));
            outputVoltage = LOW_VOLTAGE;
        }

        protected override float CalculateOutput()
        {
            if (nodes.Count < 3) return LOW_VOLTAGE;
            bool inputAHigh = IsInputHigh(nodes[0]);
            bool inputBHigh = IsInputHigh(nodes[1]);
            return (inputAHigh ^ inputBHigh) ? HIGH_VOLTAGE : LOW_VOLTAGE;
        }

        public override string GetStateDisplay()
        {
            bool a = nodes.Count >= 1 && IsInputHigh(nodes[0]);
            bool b = nodes.Count >= 2 && IsInputHigh(nodes[1]);
            bool output = outputVoltage >= THRESHOLD;
            return $"异或门 (XOR)\nA: {(a ? "高" : "低")}\nB: {(b ? "高" : "低")}\n输出: {(output ? "高" : "低")}\nVout: {outputVoltage:F2}V";
        }
    }
}