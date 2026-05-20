using UnityEngine;
using System;
using System.Collections.Generic;
using System.Linq;
using CircuitSimulator.Components;

namespace CircuitSimulator.Core
{
    public class PerformanceOptimizer : MonoBehaviour
    {
        public static PerformanceOptimizer Instance { get; private set; }

        [Header("Detection Thresholds")]
        [SerializeField] private int elementWarningThreshold = 50;
        [SerializeField] private int nodeWarningThreshold = 100;
        [SerializeField] private float fpsWarningThreshold = 30f;
        [SerializeField] private float simulationTimeThreshold = 0.016f;
        [SerializeField] private float checkInterval = 1f;

        [Header("Optimization Options")]
        [SerializeField] private bool autoOptimize = false;
        [SerializeField] private float lodDistance = 10f;

        private List<PerformanceIssue> activeIssues = new List<PerformanceIssue>();
        private Dictionary<string, PerformanceSuggestion> suggestions = new Dictionary<string, PerformanceSuggestion>();

        private float checkTimer;
        private float[] fpsHistory = new float[60];
        private int fpsHistoryIndex;
        private float avgFps;

        public event Action<PerformanceIssue> OnIssueDetected;
        public event Action<PerformanceIssue> OnIssueResolved;

        [System.Serializable]
        public class PerformanceIssue
        {
            public IssueType type;
            public Severity severity;
            public string message;
            public string suggestionId;
            public float detectedTime;
            public bool isActive;
        }

        public enum IssueType
        {
            TooManyElements,
            HighNodeCount,
            LowFPS,
            LongSimulationTime,
            GroundLoop,
            FloatingNodes,
            RedundantWires,
            HighResistancePath,
            UnnecessaryComponents,
            LargeCapacitance,
            InductorCoupling
        }

        public enum Severity
        {
            Info,
            Warning,
            Critical
        }

        [System.Serializable]
        public class PerformanceSuggestion
        {
            public string id;
            public string title;
            public string description;
            public List<string> steps = new List<string>();
            public float estimatedImprovement;
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

            InitializeSuggestions();
        }

        private void InitializeSuggestions()
        {
            suggestions["TooManyElements"] = new PerformanceSuggestion
            {
                id = "TooManyElements",
                title = "元件数量过多",
                description = "电路中的元件数量过多，可能导致计算性能下降。",
                steps = new List<string>
                {
                    "考虑将电路模块化，使用子电路功能",
                    "移除不必要的导线和重复元件",
                    "启用多线程模拟选项",
                    "使用近似模型替代精确计算"
                },
                estimatedImprovement = 40f
            };

            suggestions["HighNodeCount"] = new PerformanceSuggestion
            {
                id = "HighNodeCount",
                title = "节点数量过多",
                description = "电路节点数量过多，矩阵求解复杂度呈平方增长。",
                steps = new List<string>
                {
                    "合并相邻的连接点",
                    "使用星网变换减少节点数",
                    "考虑使用行为级模型",
                    "启用稀疏矩阵求解器"
                },
                estimatedImprovement = 60f
            };

            suggestions["LowFPS"] = new PerformanceSuggestion
            {
                id = "LowFPS",
                title = "帧率过低",
                description = "渲染或模拟计算导致帧率下降。",
                steps = new List<string>
                {
                    "降低渲染质量设置",
                    "减少导线可视化的顶点数量",
                    "关闭不必要的视觉效果（如发光、粒子）",
                    "增加模拟步长，降低更新频率",
                    "启用后台线程计算"
                },
                estimatedImprovement = 50f
            };

            suggestions["GroundLoop"] = new PerformanceSuggestion
            {
                id = "GroundLoop",
                title = "检测到接地环路",
                description = "存在多个接地节点形成环路，可能导致计算不稳定。",
                steps = new List<string>
                {
                    "移除多余的接地点，保留一个主接地点",
                    "使用星形接地方式替代环形接地",
                    "检查导线连接是否正确"
                },
                estimatedImprovement = 15f
            };

            suggestions["FloatingNodes"] = new PerformanceSuggestion
            {
                id = "FloatingNodes",
                title = "存在悬空节点",
                description = "部分节点未连接到任何元件，可能导致计算错误。",
                steps = new List<string>
                {
                    "检查并删除悬空的导线端点",
                    "确保所有元件都正确连接到电路",
                    "为悬空节点添加高阻接地"
                },
                estimatedImprovement = 10f
            };

            suggestions["RedundantWires"] = new PerformanceSuggestion
            {
                id = "RedundantWires",
                title = "冗余导线",
                description = "存在多根平行导线连接相同节点，可以合并。",
                steps = new List<string>
                {
                    "合并平行导线为单根导线",
                    "使用更粗的导线表示大电流路径",
                    "移除重复的连接"
                },
                estimatedImprovement = 20f
            };

            suggestions["LargeCapacitance"] = new PerformanceSuggestion
            {
                id = "LargeCapacitance",
                title = "电容值过大",
                description = "大电容需要更小的时间步长才能稳定模拟。",
                steps = new List<string>
                {
                    "考虑使用更小的模拟时间步长",
                    "如果是旁路电容，可以合并或简化",
                    "对于数字电路，考虑使用理想开关模型"
                },
                estimatedImprovement = 30f
            };
        }

        private void Update()
        {
            fpsHistory[fpsHistoryIndex] = 1f / Time.unscaledDeltaTime;
            fpsHistoryIndex = (fpsHistoryIndex + 1) % fpsHistory.Length;
            avgFps = fpsHistory.Average();

            checkTimer += Time.deltaTime;
            if (checkTimer >= checkInterval)
            {
                CheckPerformance();
                checkTimer = 0f;
            }
        }

        private void CheckPerformance()
        {
            var elements = CircuitSimulator.Instance.GetAllElements();
            int elementCount = elements.Count;
            int nodeCount = CountTotalNodes(elements);

            CheckElementCount(elementCount);
            CheckNodeCount(nodeCount);
            CheckFPS();
            CheckGroundLoops(elements);
            CheckFloatingNodes(elements);
            CheckRedundantWires(elements);
            CheckLargeCapacitance(elements);

            ResolveOldIssues();
        }

        private int CountTotalNodes(List<CircuitElement> elements)
        {
            var allNodes = new HashSet<CircuitNode>();
            foreach (var element in elements)
            {
                foreach (var node in element.Nodes)
                {
                    allNodes.Add(node);
                }
            }
            return allNodes.Count;
        }

        private void CheckElementCount(int count)
        {
            if (count > elementWarningThreshold)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.TooManyElements,
                    severity = count > elementWarningThreshold * 2 ? Severity.Critical : Severity.Warning,
                    message = $"电路包含 {count} 个元件，建议优化",
                    suggestionId = "TooManyElements",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckNodeCount(int count)
        {
            if (count > nodeWarningThreshold)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.HighNodeCount,
                    severity = count > nodeWarningThreshold * 2 ? Severity.Critical : Severity.Warning,
                    message = $"电路包含 {count} 个节点，建议减少节点数",
                    suggestionId = "HighNodeCount",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckFPS()
        {
            if (avgFps < fpsWarningThreshold)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.LowFPS,
                    severity = avgFps < fpsWarningThreshold * 0.5f ? Severity.Critical : Severity.Warning,
                    message = $"当前帧率 {avgFps:F1} FPS，低于建议阈值",
                    suggestionId = "LowFPS",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckGroundLoops(List<CircuitElement> elements)
        {
            int groundCount = 0;
            foreach (var element in elements)
            {
                foreach (var node in element.Nodes)
                {
                    if (node.IsGround) groundCount++;
                }
            }

            if (groundCount > 3)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.GroundLoop,
                    severity = Severity.Warning,
                    message = $"检测到 {groundCount} 个接地点，可能形成环路",
                    suggestionId = "GroundLoop",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckFloatingNodes(List<CircuitElement> elements)
        {
            var nodeConnections = new Dictionary<CircuitNode, int>();
            
            foreach (var element in elements)
            {
                foreach (var node in element.Nodes)
                {
                    if (!nodeConnections.ContainsKey(node))
                    {
                        nodeConnections[node] = 0;
                    }
                    nodeConnections[node]++;
                }
            }

            int floatingCount = nodeConnections.Values.Count(c => c == 1);
            
            if (floatingCount > 5)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.FloatingNodes,
                    severity = Severity.Info,
                    message = $"检测到 {floatingCount} 个悬空节点",
                    suggestionId = "FloatingNodes",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckRedundantWires(List<CircuitElement> elements)
        {
            var wirePairs = new Dictionary<Tuple<CircuitNode, CircuitNode>, int>();
            
            foreach (var element in elements)
            {
                if (element is Wire wire && wire.Nodes.Count >= 2)
                {
                    var key = Tuple.Create(wire.Nodes[0], wire.Nodes[1]);
                    var reversedKey = Tuple.Create(wire.Nodes[1], wire.Nodes[0]);
                    
                    if (wirePairs.ContainsKey(key))
                    {
                        wirePairs[key]++;
                    }
                    else if (wirePairs.ContainsKey(reversedKey))
                    {
                        wirePairs[reversedKey]++;
                    }
                    else
                    {
                        wirePairs[key] = 1;
                    }
                }
            }

            int redundantCount = wirePairs.Values.Count(c => c > 1);
            
            if (redundantCount > 0)
            {
                DetectIssue(new PerformanceIssue
                {
                    type = IssueType.RedundantWires,
                    severity = Severity.Info,
                    message = $"发现 {redundantCount} 组冗余导线",
                    suggestionId = "RedundantWires",
                    detectedTime = Time.time
                });
            }
        }

        private void CheckLargeCapacitance(List<CircuitElement> elements)
        {
            foreach (var element in elements)
            {
                if (element is Capacitor capacitor)
                {
                    var param = capacitor.GetParameters();
                    if (param.TryGetValue("Capacitance", out float c) && c > 0.1f)
                    {
                        DetectIssue(new PerformanceIssue
                        {
                            type = IssueType.LargeCapacitance,
                            severity = Severity.Warning,
                            message = $"检测到大电容值 {c:F3} F，可能影响稳定性",
                            suggestionId = "LargeCapacitance",
                            detectedTime = Time.time
                        });
                        break;
                    }
                }
            }
        }

        private void DetectIssue(PerformanceIssue issue)
        {
            var existing = activeIssues.Find(i => i.type == issue.type);
            if (existing != null)
            {
                existing.detectedTime = Time.time;
                if (existing.severity != issue.severity)
                {
                    existing.severity = issue.severity;
                    OnIssueDetected?.Invoke(issue);
                }
            }
            else
            {
                issue.isActive = true;
                activeIssues.Add(issue);
                OnIssueDetected?.Invoke(issue);
                Debug.LogWarning($"[Performance] {issue.message}");
            }
        }

        private void ResolveOldIssues()
        {
            float timeout = 5f;
            for (int i = activeIssues.Count - 1; i >= 0; i--)
            {
                if (Time.time - activeIssues[i].detectedTime > timeout)
                {
                    var issue = activeIssues[i];
                    issue.isActive = false;
                    activeIssues.RemoveAt(i);
                    OnIssueResolved?.Invoke(issue);
                }
            }
        }

        public List<PerformanceIssue> GetActiveIssues()
        {
            return new List<PerformanceIssue>(activeIssues);
        }

        public PerformanceSuggestion GetSuggestion(string suggestionId)
        {
            return suggestions.TryGetValue(suggestionId, out var s) ? s : null;
        }

        public Dictionary<string, PerformanceSuggestion> GetAllSuggestions()
        {
            return new Dictionary<string, PerformanceSuggestion>(suggestions);
        }

        public void ApplyAutomaticOptimizations()
        {
            if (!autoOptimize) return;

            Debug.Log("[Performance] Applying automatic optimizations...");

            foreach (var issue in activeIssues)
            {
                switch (issue.type)
                {
                    case IssueType.LowFPS:
                        ElementVisualizer.Instance.SetColorIntensity(0.3f);
                        break;
                }
            }
        }

        public float GetAverageFPS()
        {
            return avgFps;
        }

        public int GetIssueCount()
        {
            return activeIssues.Count;
        }

        public int GetIssueCount(Severity severity)
        {
            return activeIssues.Count(i => i.severity == severity);
        }

        public void SetThresholds(int elements, int nodes, float fps)
        {
            elementWarningThreshold = elements;
            nodeWarningThreshold = nodes;
            fpsWarningThreshold = fps;
        }
    }
}
