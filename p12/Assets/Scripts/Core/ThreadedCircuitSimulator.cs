using UnityEngine;
using System.Threading;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System;

namespace CircuitSimulator.Core
{
    public class ThreadedCircuitSimulator : MonoBehaviour
    {
        public static ThreadedCircuitSimulator Instance { get; private set; }

        [Header("Thread Settings")]
        [SerializeField] private int simulationRateMs = 16;
        [SerializeField] private int maxIterationsPerStep = 100;
        [SerializeField] private bool useBackgroundThread = true;

        private Thread simulationThread;
        private volatile bool isRunning;
        private AutoResetEvent simulationTrigger = new AutoResetEvent(false);

        private readonly object dataLock = new object();
        private SimulationInput inputData = new SimulationInput();
        private SimulationOutput outputData = new SimulationOutput();

        private ConcurrentQueue<SimulationCommand> commandQueue = new ConcurrentQueue<SimulationCommand>();
        private ConcurrentQueue<SimulationResult> resultQueue = new ConcurrentQueue<SimulationResult>();

        private SparseMatrix conductanceMatrix;
        private float[] currentVector;
        private float[] voltageVector;
        private int matrixSize;

        public event Action<SimulationOutput> OnSimulationComplete;
        public event Action<string> OnSimulationError;

        [System.Serializable]
        public class SimulationInput
        {
            public List<ElementData> elements = new List<ElementData>();
            public int nodeCount;
            public float timeStep;
        }

        [System.Serializable]
        public class SimulationOutput
        {
            public Dictionary<int, float> nodeVoltages = new Dictionary<int, float>();
            public Dictionary<int, float> elementCurrents = new Dictionary<int, float>();
            public float simulationTime;
            public bool isValid;
            public string errorMessage;
        }

        [System.Serializable]
        public class ElementData
        {
            public int id;
            public string type;
            public float value;
            public int[] nodeIndices;
            public float[] parameters;
        }

        public class SimulationCommand
        {
            public CommandType type;
            public object data;
        }

        public enum CommandType
        {
            AddElement,
            RemoveElement,
            UpdateElement,
            ConnectNodes,
            DisconnectNodes,
            Reset,
            Step
        }

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

        private void Start()
        {
            if (useBackgroundThread)
            {
                StartSimulationThread();
            }
        }

        public void StartSimulationThread()
        {
            if (isRunning) return;

            isRunning = true;
            simulationThread = new Thread(SimulationLoop)
            {
                IsBackground = true,
                Priority = System.Threading.ThreadPriority.AboveNormal
            };
            simulationThread.Start();
        }

        public void StopSimulationThread()
        {
            isRunning = false;
            simulationTrigger.Set();
            simulationThread?.Join(1000);
        }

        private void SimulationLoop()
        {
            while (isRunning)
            {
                simulationTrigger.WaitOne(simulationRateMs);
                if (!isRunning) break;

                try
                {
                    ProcessCommands();
                    ExecuteSimulationStep();
                }
                catch (Exception e)
                {
                    EnqueueResult(new SimulationResult
                    {
                        isError = true,
                        errorMessage = e.Message
                    });
                }
            }
        }

        private void ProcessCommands()
        {
            while (commandQueue.TryDequeue(out var command))
            {
                switch (command.type)
                {
                    case CommandType.AddElement:
                        AddElementInternal(command.data as ElementData);
                        break;
                    case CommandType.RemoveElement:
                        RemoveElementInternal((int)command.data);
                        break;
                    case CommandType.UpdateElement:
                        UpdateElementInternal(command.data as ElementData);
                        break;
                    case CommandType.Reset:
                        ResetSimulationInternal();
                        break;
                }
            }
        }

        private void AddElementInternal(ElementData element)
        {
            lock (dataLock)
            {
                inputData.elements.Add(element);
            }
        }

        private void RemoveElementInternal(int elementId)
        {
            lock (dataLock)
            {
                inputData.elements.RemoveAll(e => e.id == elementId);
            }
        }

        private void UpdateElementInternal(ElementData element)
        {
            lock (dataLock)
            {
                var existing = inputData.elements.Find(e => e.id == element.id);
                if (existing != null)
                {
                    existing.value = element.value;
                    existing.parameters = element.parameters;
                }
            }
        }

        private void ResetSimulationInternal()
        {
            lock (dataLock)
            {
                inputData.elements.Clear();
                inputData.nodeCount = 0;
                outputData.nodeVoltages.Clear();
                outputData.elementCurrents.Clear();
            }
        }

        private void ExecuteSimulationStep()
        {
            lock (dataLock)
            {
                if (inputData.elements.Count == 0) return;
                BuildMatrix();
                SolveCircuit();
                CollectResults();
            }
        }

        private void BuildMatrix()
        {
            matrixSize = inputData.nodeCount;
            if (conductanceMatrix == null || conductanceMatrix.Size != matrixSize)
            {
                conductanceMatrix = new SparseMatrix(matrixSize);
                currentVector = new float[matrixSize];
                voltageVector = new float[matrixSize];
            }
            else
            {
                conductanceMatrix.Clear();
            }

            Array.Clear(currentVector, 0, currentVector.Length);

            foreach (var element in inputData.elements)
            {
                ApplyElementToMatrix(element);
            }
        }

        private void ApplyElementToMatrix(ElementData element)
        {
            if (element.nodeIndices == null || element.nodeIndices.Length < 2) return;

            int n0 = element.nodeIndices[0];
            int n1 = element.nodeIndices[1];

            switch (element.type)
            {
                case "Resistor":
                case "Wire":
                    float g = 1f / Mathf.Max(element.value, 1e-6f);
                    if (n0 >= 0) conductanceMatrix.Add(n0, n0, g);
                    if (n1 >= 0) conductanceMatrix.Add(n1, n1, g);
                    if (n0 >= 0 && n1 >= 0)
                    {
                        conductanceMatrix.Add(n0, n1, -g);
                        conductanceMatrix.Add(n1, n0, -g);
                    }
                    break;

                case "VoltageSource":
                    float v = element.value;
                    float rInt = 0.1f;
                    float gInt = 1f / rInt;
                    if (n0 >= 0)
                    {
                        conductanceMatrix.Add(n0, n0, gInt);
                        currentVector[n0] += v * gInt;
                    }
                    if (n1 >= 0)
                    {
                        conductanceMatrix.Add(n1, n1, gInt);
                        currentVector[n1] -= v * gInt;
                    }
                    if (n0 >= 0 && n1 >= 0)
                    {
                        conductanceMatrix.Add(n0, n1, -gInt);
                        conductanceMatrix.Add(n1, n0, -gInt);
                    }
                    break;

                case "Capacitor":
                    float c = element.value;
                    float dt = inputData.timeStep;
                    float gCap = c / dt;
                    if (n0 >= 0) conductanceMatrix.Add(n0, n0, gCap);
                    if (n1 >= 0) conductanceMatrix.Add(n1, n1, gCap);
                    if (n0 >= 0 && n1 >= 0)
                    {
                        conductanceMatrix.Add(n0, n1, -gCap);
                        conductanceMatrix.Add(n1, n0, -gCap);
                    }
                    break;

                case "Inductor":
                    float l = element.value;
                    float gInd = dt / Mathf.Max(l, 1e-6f);
                    if (n0 >= 0) conductanceMatrix.Add(n0, n0, gInd);
                    if (n1 >= 0) conductanceMatrix.Add(n1, n1, gInd);
                    if (n0 >= 0 && n1 >= 0)
                    {
                        conductanceMatrix.Add(n0, n1, -gInd);
                        conductanceMatrix.Add(n1, n0, -gInd);
                    }
                    break;
            }
        }

        private void SolveCircuit()
        {
            if (matrixSize == 0) return;

            Array.Clear(voltageVector, 0, voltageVector.Length);

            SparseLinearSolver.SolveGaussSeidel(
                conductanceMatrix, 
                currentVector, 
                voltageVector, 
                maxIterationsPerStep, 
                1e-4f
            );
        }

        private void CollectResults()
        {
            outputData.nodeVoltages.Clear();
            outputData.elementCurrents.Clear();

            for (int i = 0; i < matrixSize; i++)
            {
                outputData.nodeVoltages[i] = voltageVector[i];
            }

            for (int i = 0; i < inputData.elements.Count; i++)
            {
                var element = inputData.elements[i];
                if (element.nodeIndices != null && element.nodeIndices.Length >= 2)
                {
                    int n0 = element.nodeIndices[0];
                    int n1 = element.nodeIndices[1];
                    float v0 = n0 >= 0 && n0 < matrixSize ? voltageVector[n0] : 0f;
                    float v1 = n1 >= 0 && n1 < matrixSize ? voltageVector[n1] : 0f;
                    float current = (v0 - v1) / Mathf.Max(element.value, 1e-6f);
                    outputData.elementCurrents[element.id] = current;
                }
            }

            outputData.isValid = true;
            outputData.simulationTime += inputData.timeStep;

            EnqueueResult(new SimulationResult
            {
                isError = false,
                output = outputData
            });
        }

        private void EnqueueResult(SimulationResult result)
        {
            resultQueue.Enqueue(result);
        }

        private void Update()
        {
            if (!useBackgroundThread)
            {
                ProcessCommands();
                ExecuteSimulationStep();
                DispatchResults();
            }
            else
            {
                DispatchResults();
            }
        }

        private void DispatchResults()
        {
            while (resultQueue.TryDequeue(out var result))
            {
                if (result.isError)
                {
                    OnSimulationError?.Invoke(result.errorMessage);
                }
                else
                {
                    OnSimulationComplete?.Invoke(result.output);
                }
            }
        }

        public void QueueCommand(CommandType type, object data = null)
        {
            commandQueue.Enqueue(new SimulationCommand
            {
                type = type,
                data = data
            });
        }

        public void TriggerSimulation()
        {
            simulationTrigger.Set();
        }

        public SimulationOutput GetLatestOutput()
        {
            lock (dataLock)
            {
                return outputData;
            }
        }

        public int GetQueueLength()
        {
            return commandQueue.Count;
        }

        private void OnDestroy()
        {
            StopSimulationThread();
            simulationTrigger?.Dispose();
        }

        private class SimulationResult
        {
            public bool isError;
            public string errorMessage;
            public SimulationOutput output;
        }
    }
}
