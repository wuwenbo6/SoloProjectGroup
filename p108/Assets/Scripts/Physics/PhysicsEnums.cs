using UnityEngine;

namespace MortiseTenonGame.Physics
{
    public enum JointType
    {
        Mortise,
        Tenon,
        Both
    }

    public enum ConnectionStrength
    {
        None,
        Weak,
        Medium,
        Strong,
        Perfect
    }

    public struct ConnectionInfo
    {
        public ConnectionStrength Strength;
        public float AlignmentError;
        public float InsertionDepth;
        public bool IsFullyConnected;
    }
}