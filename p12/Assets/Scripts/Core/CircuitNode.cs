using UnityEngine;

namespace CircuitSimulator.Core
{
    public class CircuitNode
    {
        public Vector2 Position { get; }
        public float Voltage { get; set; }
        public bool IsGround { get; set; }

        public CircuitNode(Vector2 position)
        {
            Position = position;
            Voltage = 0f;
            IsGround = false;
        }
    }
}