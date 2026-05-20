using UnityEngine;
using System.Collections.Generic;

namespace CircuitSimulator.Core
{
    public abstract class CircuitElement : MonoBehaviour
    {
        public enum FaultType
        {
            None,
            ShortCircuit,
            OpenCircuit,
            ParameterDrift
        }

        [SerializeField] protected string elementName;
        [SerializeField] protected Sprite elementSprite;
        [SerializeField] protected Color elementColor = Color.white;

        protected List<CircuitNode> nodes = new List<CircuitNode>();
        protected float current;
        protected float voltage;
        protected float power;
        
        [SerializeField] protected FaultType currentFault = FaultType.None;
        protected float faultParameter = 0f;
        protected bool isDigitalElement = false;

        public string ElementName => elementName;
        public Sprite ElementSprite => elementSprite;
        public float Current => current;
        public float Voltage => voltage;
        public float Power => power;
        public IReadOnlyList<CircuitNode> Nodes => nodes.AsReadOnly();

        public int NodeCount => nodes.Count;
        public FaultType CurrentFault => currentFault;
        public bool HasFault => currentFault != FaultType.None;
        public bool IsDigitalElement => isDigitalElement;

        public virtual void SetFault(FaultType fault, float parameter = 0f)
        {
            currentFault = fault;
            faultParameter = parameter;
        }

        public virtual void ClearFault()
        {
            currentFault = FaultType.None;
            faultParameter = 0f;
        }

        protected float GetEffectiveResistance(float baseResistance)
        {
            switch (currentFault)
            {
                case FaultType.ShortCircuit:
                    return 0.0001f;
                case FaultType.OpenCircuit:
                    return 1e10f;
                case FaultType.ParameterDrift:
                    return baseResistance * (1f + faultParameter);
                default:
                    return baseResistance;
            }
        }

        protected virtual void Awake()
        {
            InitializeNodes();
        }

        protected abstract void InitializeNodes();

        public abstract void CalculateCurrent();

        public abstract void UpdateState(float deltaTime);

        public virtual void ApplyToMatrix(SparseMatrix matrix, float[] vector, Dictionary<CircuitNode, int> nodeIndices)
        {
        }

        public virtual void Rotate(float angle)
        {
            transform.Rotate(0, 0, angle);
        }

        public CircuitNode GetNode(int index)
        {
            if (index >= 0 && index < nodes.Count)
                return nodes[index];
            return null;
        }

        public virtual Dictionary<string, object> GetParameters()
        {
            return new Dictionary<string, object>();
        }

        public virtual void SetParameter(string key, object value)
        {
        }

        public virtual string GetStateDisplay()
        {
            string faultText = "";
            if (HasFault)
            {
                faultText = currentFault switch
                {
                    FaultType.ShortCircuit => "\n⚠ 故障: 短路",
                    FaultType.OpenCircuit => "\n⚠ 故障: 开路",
                    FaultType.ParameterDrift => $"\n⚠ 故障: 参数漂移 ({faultParameter:P0})",
                    _ => ""
                };
            }
            return $"I: {current:F2}A\nV: {voltage:F2}V\nP: {power:F2}W{faultText}";
        }

        protected void OnDrawGizmos()
        {
            Gizmos.color = elementColor;
            Gizmos.DrawWireCube(transform.position, Vector3.one * 0.8f);
        }
    }
}