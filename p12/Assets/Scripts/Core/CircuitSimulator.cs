using UnityEngine;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;

namespace CircuitSimulator.Core
{
    public class CircuitSimulator : MonoBehaviour
    {
        public enum SolverType
        {
            GaussSeidelSparse,
            ConjugateGradient
        }

        public static CircuitSimulator Instance { get; private set; }

        private List<CircuitElement> elements = new List<CircuitElement>(200);
        private List<CircuitNode> allNodes = new List<CircuitNode>(400);
        private Dictionary<CircuitNode, List<CircuitNode>> connections = new Dictionary<CircuitNode, List<CircuitNode>>();
        private Dictionary<CircuitNode, int> nodeToIndex = new Dictionary<CircuitNode, int>();

        [SerializeField] private float simulationRate = 0.033f;
        [SerializeField] private int maxIterations = 50;
        [SerializeField] private float convergenceThreshold = 0.001f;
        [SerializeField] private bool adaptiveSimulation = true;
        [SerializeField] private SolverType solverType = SolverType.GaussSeidelSparse;
        [SerializeField] private bool showPerformanceStats = false;

        private float simulationTimer;
        private float simulationTime;

        private SparseMatrix conductanceMatrix;
        private float[] currentVector;
        private float[] voltageVector;
        private int matrixSize;

        private bool circuitChanged = true;
        private int frameCounter;
        private Stopwatch solveTimer = new Stopwatch();
        private int lastNonZeroCount;

        public static float SimulationTime => Instance?.simulationTime ?? 0f;
        public static event System.Action OnSimulationStep;
        public System.Action<string> OnPerformanceLog;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Update()
        {
            simulationTimer += Time.deltaTime;
            frameCounter++;

            int requiredFrames = adaptiveSimulation ? Mathf.Clamp(elements.Count / 25, 1, 3) : 1;
            
            if (simulationTimer >= simulationRate && frameCounter >= requiredFrames)
            {
                Simulate();
                simulationTimer = 0f;
                frameCounter = 0;
            }
        }

        public void RegisterElement(CircuitElement element)
        {
            if (!elements.Contains(element))
            {
                elements.Add(element);
                foreach (var node in element.Nodes)
                {
                    if (!allNodes.Contains(node))
                    {
                        allNodes.Add(node);
                        connections[node] = new List<CircuitNode>();
                    }
                }
                circuitChanged = true;
            }
        }

        public void UnregisterElement(CircuitElement element)
        {
            elements.Remove(element);
            foreach (var node in element.Nodes)
            {
                allNodes.Remove(node);
                connections.Remove(node);
            }
            circuitChanged = true;
        }

        public void ConnectNodes(CircuitNode nodeA, CircuitNode nodeB)
        {
            if (!connections.ContainsKey(nodeA))
                connections[nodeA] = new List<CircuitNode>();
            if (!connections.ContainsKey(nodeB))
                connections[nodeB] = new List<CircuitNode>();

            if (!connections[nodeA].Contains(nodeB))
                connections[nodeA].Add(nodeB);
            if (!connections[nodeB].Contains(nodeA))
                connections[nodeB].Add(nodeA);

            circuitChanged = true;
        }

        public void DisconnectNodes(CircuitNode nodeA, CircuitNode nodeB)
        {
            if (connections.ContainsKey(nodeA))
                connections[nodeA].Remove(nodeB);
            if (connections.ContainsKey(nodeB))
                connections[nodeB].Remove(nodeA);

            circuitChanged = true;
        }

        private void Simulate()
        {
            if (elements.Count == 0) return;

            if (circuitChanged)
            {
                BuildNodeMapping();
                circuitChanged = false;
            }

            SolveCircuitModifiedNodal();
            UpdateElementStates();
            
            simulationTime += simulationRate;
            OnSimulationStep?.Invoke();
        }

        public void ResetSimulationTime()
        {
            simulationTime = 0f;
        }

        private void BuildNodeMapping()
        {
            nodeToIndex.Clear();
            int index = 0;
            for (int i = 0; i < allNodes.Count; i++)
            {
                var node = allNodes[i];
                if (!node.IsGround)
                {
                    nodeToIndex[node] = index++;
                }
            }

            int newNodeCount = nodeToIndex.Count;
            if (newNodeCount != matrixSize)
            {
                ResizeMatrix(newNodeCount);
            }
        }

        private void ResizeMatrix(int size)
        {
            matrixSize = size;
            if (conductanceMatrix == null)
            {
                conductanceMatrix = new SparseMatrix(size);
            }
            else
            {
                conductanceMatrix.Resize(size);
            }
            currentVector = new float[size];
            voltageVector = new float[size];
        }

        private void SolveCircuitModifiedNodal()
        {
            solveTimer.Restart();

            if (matrixSize == 0)
            {
                for (int i = 0; i < allNodes.Count; i++)
                {
                    if (allNodes[i].IsGround)
                    {
                        allNodes[i].Voltage = 0f;
                    }
                }
                return;
            }

            for (int i = 0; i < allNodes.Count; i++)
            {
                if (allNodes[i].IsGround)
                {
                    allNodes[i].Voltage = 0f;
                }
            }

            conductanceMatrix.Clear();
            for (int i = 0; i < matrixSize; i++)
            {
                currentVector[i] = 0f;
            }

            for (int i = 0; i < elements.Count; i++)
            {
                elements[i].ApplyToMatrix(conductanceMatrix, currentVector, nodeToIndex);
            }

            lastNonZeroCount = conductanceMatrix.NonZeroCount();
            bool solved = false;

            switch (solverType)
            {
                case SolverType.GaussSeidelSparse:
                    solved = SparseLinearSolver.SolveGaussSeidel(
                        conductanceMatrix, currentVector, voltageVector, 
                        maxIterations, convergenceThreshold);
                    break;
                case SolverType.ConjugateGradient:
                    solved = SparseLinearSolver.SolveConjugateGradient(
                        conductanceMatrix, currentVector, voltageVector,
                        maxIterations, convergenceThreshold);
                    break;
            }

            if (solved)
            {
                foreach (var kvp in nodeToIndex)
                {
                    kvp.Key.Voltage = voltageVector[kvp.Value];
                }
            }

            for (int i = 0; i < elements.Count; i++)
            {
                elements[i].CalculateCurrent();
            }

            solveTimer.Stop();
            if (showPerformanceStats)
            {
                LogPerformance();
            }
        }

        private void LogPerformance()
        {
            float fillRate = matrixSize > 0 ? (float)lastNonZeroCount / (matrixSize * matrixSize) : 0f;
            string log = $"Circuit: {elements.Count} elements, {matrixSize} nodes, ";
            log += $"NZ: {lastNonZeroCount}, fill: {fillRate:P2}, time: {solveTimer.ElapsedMilliseconds}ms";
            OnPerformanceLog?.Invoke(log);
            UnityEngine.Debug.Log(log);
        }

        private void UpdateElementStates()
        {
            for (int i = 0; i < elements.Count; i++)
            {
                elements[i].UpdateState(simulationRate);
            }
        }

        public CircuitNode FindNearestNode(Vector2 position, float maxDistance = 0.5f)
        {
            CircuitNode nearest = null;
            float minDist = maxDistance;
            float sqrMaxDist = maxDistance * maxDistance;

            for (int i = 0; i < allNodes.Count; i++)
            {
                var node = allNodes[i];
                float sqrDist = (position - node.Position).sqrMagnitude;
                if (sqrDist < sqrMaxDist)
                {
                    sqrMaxDist = sqrDist;
                    nearest = node;
                }
            }

            return nearest;
        }

        public List<CircuitElement> GetAllElements()
        {
            return new List<CircuitElement>(elements);
        }

        public void ClearCircuit()
        {
            elements.Clear();
            allNodes.Clear();
            connections.Clear();
            nodeToIndex.Clear();
            conductanceMatrix = null;
            currentVector = null;
            voltageVector = null;
            matrixSize = 0;
            circuitChanged = true;
        }

        public int GetElementCount()
        {
            return elements.Count;
        }

        public void SetSolverType(SolverType type)
        {
            solverType = type;
        }
    }
}
