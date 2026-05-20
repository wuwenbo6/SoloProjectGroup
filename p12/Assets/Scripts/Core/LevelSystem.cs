using UnityEngine;
using System;
using System.Collections.Generic;
using CircuitSimulator.Components;

namespace CircuitSimulator.Core
{
    public class LevelSystem : MonoBehaviour
    {
        public static LevelSystem Instance { get; private set; }

        [System.Serializable]
        public class Level
        {
            public int id;
            public string name;
            public string description;
            public string category;
            public int difficulty;
            public List<string> requiredComponents = new List<string>();
            public List<Goal> goals = new List<Goal>();
            public List<Hint> hints = new List<Hint>();
        }

        [System.Serializable]
        public class Goal
        {
            public GoalType type;
            public string description;
            public string targetElement;
            public float targetValue;
            public float tolerance = 0.1f;
            public bool completed;
        }

        public enum GoalType
        {
            VoltageAtNode,
            CurrentThroughElement,
            CreateComponent,
            ConnectNodes,
            LEDOn,
            LogicOutputHigh,
            LogicOutputLow
        }

        [System.Serializable]
        public class Hint
        {
            public string text;
            public int unlockAfterSeconds = 30;
        }

        private List<Level> allLevels = new List<Level>();
        private Level currentLevel;
        private bool levelActive;
        private float levelTime;
        private Dictionary<int, bool> completedLevels = new Dictionary<int, bool>();

        public event Action<Level> OnLevelStarted;
        public event Action<Level> OnLevelCompleted;
        public event Action<Goal> OnGoalCompleted;

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

            InitializeLevels();
        }

        private void InitializeLevels()
        {
            allLevels.Add(new Level
            {
                id = 1,
                name = "第一个电路",
                description = "连接一个简单的电压源和电阻，形成完整的回路。",
                category = "基础",
                difficulty = 1,
                requiredComponents = new List<string> { "VoltageSource", "Resistor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.CurrentThroughElement, description = "电阻中应有电流通过", targetElement = "Resistor", targetValue = 0.01f, tolerance = 0.005f }
                },
                hints = new List<Hint>
                {
                    new Hint { text = "将电压源的两端用导线和电阻连接起来，形成一个闭合回路。", unlockAfterSeconds = 10 }
                }
            });

            allLevels.Add(new Level
            {
                id = 2,
                name = "串联电阻",
                description = "将两个电阻串联连接，观察总电阻的变化。",
                category = "基础",
                difficulty = 1,
                requiredComponents = new List<string> { "VoltageSource", "Resistor", "Resistor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.VoltageAtNode, description = "在电阻连接点测量电压", targetValue = 2.5f }
                }
            });

            allLevels.Add(new Level
            {
                id = 3,
                name = "LED闪烁电路",
                description = "使用电容和电阻构建一个简单的RC电路，观察充放电现象。",
                category = "进阶",
                difficulty = 2,
                requiredComponents = new List<string> { "VoltageSource", "Resistor", "Capacitor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.VoltageAtNode, description = "电容电压应达到电源电压的90%", targetValue = 4.5f }
                }
            });

            allLevels.Add(new Level
            {
                id = 4,
                name = "二极管整流",
                description = "使用二极管构建半波整流电路，观察交流信号的变化。",
                category = "半导体",
                difficulty = 2,
                requiredComponents = new List<string> { "ACVoltageSource", "Diode", "Resistor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.VoltageAtNode, description = "输出应为单向脉动直流", targetValue = 0f }
                }
            });

            allLevels.Add(new Level
            {
                id = 5,
                name = "非门电路",
                description = "使用逻辑门构建一个反相器电路。",
                category = "数字电路",
                difficulty = 2,
                requiredComponents = new List<string> { "VoltageSource", "NotGate", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.LogicOutputHigh, description = "输入低电平时输出高电平", targetValue = 5f },
                    new Goal { type = GoalType.LogicOutputLow, description = "输入高电平时输出低电平", targetValue = 0.5f }
                }
            });

            allLevels.Add(new Level
            {
                id = 6,
                name = "与门电路",
                description = "验证与门的真值表：只有当所有输入都为高电平时输出才为高。",
                category = "数字电路",
                difficulty = 2,
                requiredComponents = new List<string> { "VoltageSource", "AndGate", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.LogicOutputHigh, description = "双高输入产生高输出", targetValue = 5f }
                }
            });

            allLevels.Add(new Level
            {
                id = 7,
                name = "RLC谐振电路",
                description = "构建RLC串联谐振电路，观察谐振现象。",
                category = "高级",
                difficulty = 3,
                requiredComponents = new List<string> { "ACVoltageSource", "Resistor", "Inductor", "Capacitor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.VoltageAtNode, description = "调整频率使电路达到谐振", targetValue = 0f }
                }
            });

            allLevels.Add(new Level
            {
                id = 8,
                name = "简单报警器",
                description = "构建一个基于二极管逻辑的简单报警电路。",
                category = "综合",
                difficulty = 3,
                requiredComponents = new List<string> { "VoltageSource", "OrGate", "AndGate", "NotGate", "Resistor", "Wire" },
                goals = new List<Goal>
                {
                    new Goal { type = GoalType.LogicOutputHigh, description = "任一传感器触发时报警", targetValue = 5f }
                }
            });
        }

        public void StartLevel(int levelId)
        {
            var level = allLevels.Find(l => l.id == levelId);
            if (level == null)
            {
                Debug.LogError($"Level {levelId} not found!");
                return;
            }

            currentLevel = level;
            levelActive = true;
            levelTime = 0f;

            foreach (var goal in level.goals)
            {
                goal.completed = false;
            }

            CircuitSimulator.Instance.ClearCircuit();
            OnLevelStarted?.Invoke(level);
            Debug.Log($"Level {level.id} started: {level.name}");
        }

        public void RestartLevel()
        {
            if (currentLevel != null)
            {
                StartLevel(currentLevel.id);
            }
        }

        public void EndLevel(bool success)
        {
            if (currentLevel == null) return;

            if (success)
            {
                completedLevels[currentLevel.id] = true;
                OnLevelCompleted?.Invoke(currentLevel);
                Debug.Log($"Level {currentLevel.id} completed in {levelTime:F1}s!");
            }

            levelActive = false;
        }

        private void Update()
        {
            if (!levelActive) return;

            levelTime += Time.deltaTime;
            CheckGoals();
        }

        private void CheckGoals()
        {
            if (currentLevel == null) return;

            foreach (var goal in currentLevel.goals)
            {
                if (goal.completed) continue;

                bool result = CheckGoal(goal);
                if (result)
                {
                    goal.completed = true;
                    OnGoalCompleted?.Invoke(goal);
                    Debug.Log($"Goal completed: {goal.description}");
                }
            }

            bool allCompleted = currentLevel.goals.TrueForAll(g => g.completed);
            if (allCompleted)
            {
                EndLevel(true);
            }
        }

        private bool CheckGoal(Goal goal)
        {
            var elements = CircuitSimulator.Instance.GetAllElements();

            switch (goal.type)
            {
                case GoalType.CurrentThroughElement:
                    foreach (var element in elements)
                    {
                        if (element.GetType().Name == goal.targetElement)
                        {
                            return Mathf.Abs(element.Current) >= goal.targetValue - goal.tolerance;
                        }
                    }
                    return false;

                case GoalType.VoltageAtNode:
                    foreach (var element in elements)
                    {
                        foreach (var node in element.Nodes)
                        {
                            if (Mathf.Abs(node.Voltage - goal.targetValue) < goal.tolerance)
                                return true;
                        }
                    }
                    return false;

                case GoalType.LogicOutputHigh:
                    foreach (var element in elements)
                    {
                        if (element is LogicGate)
                        {
                            var outputNode = element.Nodes[element.Nodes.Count - 1];
                            return outputNode.Voltage > 4f;
                        }
                    }
                    return false;

                case GoalType.LogicOutputLow:
                    foreach (var element in elements)
                    {
                        if (element is LogicGate)
                        {
                            var outputNode = element.Nodes[element.Nodes.Count - 1];
                            return outputNode.Voltage < 1f;
                        }
                    }
                    return false;

                case GoalType.CreateComponent:
                    return elements.Exists(e => e.GetType().Name == goal.targetElement);

                default:
                    return false;
            }
        }

        public List<Level> GetAllLevels()
        {
            return new List<Level>(allLevels);
        }

        public List<Level> GetLevelsByCategory(string category)
        {
            return allLevels.FindAll(l => l.category == category);
        }

        public Level GetCurrentLevel()
        {
            return currentLevel;
        }

        public bool IsLevelActive()
        {
            return levelActive;
        }

        public float GetLevelTime()
        {
            return levelTime;
        }

        public bool IsLevelCompleted(int levelId)
        {
            return completedLevels.TryGetValue(levelId, out bool completed) && completed;
        }

        public int GetCompletedCount()
        {
            return completedLevels.Count;
        }

        public int GetTotalLevelCount()
        {
            return allLevels.Count;
        }

        public List<string> GetAvailableHints()
        {
            List<string> availableHints = new List<string>();
            if (currentLevel == null) return availableHints;

            foreach (var hint in currentLevel.hints)
            {
                if (levelTime >= hint.unlockAfterSeconds)
                {
                    availableHints.Add(hint.text);
                }
            }
            return availableHints;
        }
    }
}
