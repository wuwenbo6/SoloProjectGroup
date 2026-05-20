using UnityEngine;
using System;
using System.Collections.Generic;
using System.Reflection;

namespace CircuitSimulator.Core
{
    public class ComponentLibrary : MonoBehaviour
    {
        public static ComponentLibrary Instance { get; private set; }

        [System.Serializable]
        public class ComponentDefinition
        {
            public string name;
            public string displayName;
            public string category;
            public string description;
            public Type componentType;
            public Sprite icon;
            public Color color = Color.white;
            public Dictionary<string, float> defaultParameters = new Dictionary<string, float>();
        }

        private Dictionary<string, ComponentDefinition> builtInComponents = new Dictionary<string, ComponentDefinition>();
        private Dictionary<string, ComponentDefinition> customComponents = new Dictionary<string, ComponentDefinition>();
        private List<string> categories = new List<string>();

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

            RegisterBuiltInComponents();
        }

        private void RegisterBuiltInComponents()
        {
            RegisterComponent(new ComponentDefinition
            {
                name = "VoltageSource",
                displayName = "直流电压源",
                category = "电源",
                description = "提供恒定的直流电压",
                color = Color.red,
                defaultParameters = new Dictionary<string, float> { { "Voltage", 5f }, { "InternalResistance", 0.1f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "ACVoltageSource",
                displayName = "交流电压源",
                category = "电源",
                description = "提供正弦交流电压",
                color = Color.magenta,
                defaultParameters = new Dictionary<string, float> { { "Amplitude", 5f }, { "Frequency", 50f }, { "Phase", 0f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "Resistor",
                displayName = "电阻",
                category = "基础元件",
                description = "限制电流流动",
                color = Color.yellow,
                defaultParameters = new Dictionary<string, float> { { "Resistance", 100f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "Capacitor",
                displayName = "电容",
                category = "基础元件",
                description = "存储和释放电荷",
                color = Color.cyan,
                defaultParameters = new Dictionary<string, float> { { "Capacitance", 0.001f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "Inductor",
                displayName = "电感",
                category = "基础元件",
                description = "存储磁能",
                color = Color.blue,
                defaultParameters = new Dictionary<string, float> { { "Inductance", 0.01f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "Diode",
                displayName = "二极管",
                category = "半导体",
                description = "单向导电",
                color = Color.green,
                defaultParameters = new Dictionary<string, float> { { "ForwardVoltageDrop", 0.7f }, { "ReverseResistance", 1000000f } }
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "Wire",
                displayName = "导线",
                category = "连接",
                description = "连接电路节点",
                color = Color.gray
            });

            RegisterLogicGateComponents();

            categories.Clear();
            categories.Add("全部");
            foreach (var comp in builtInComponents.Values)
            {
                if (!categories.Contains(comp.category))
                    categories.Add(comp.category);
            }
        }

        private void RegisterLogicGateComponents()
        {
            RegisterComponent(new ComponentDefinition
            {
                name = "NotGate",
                displayName = "非门 (NOT)",
                category = "逻辑门",
                description = "输入输出反相",
                color = Color.Lerp(Color.red, Color.blue, 0.5f)
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "AndGate",
                displayName = "与门 (AND)",
                category = "逻辑门",
                description = "两输入全高时输出高",
                color = Color.Lerp(Color.red, Color.yellow, 0.5f)
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "OrGate",
                displayName = "或门 (OR)",
                category = "逻辑门",
                description = "任一输入高则输出高",
                color = Color.Lerp(Color.green, Color.blue, 0.5f)
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "NandGate",
                displayName = "与非门 (NAND)",
                category = "逻辑门",
                description = "与门后接非门",
                color = Color.Lerp(Color.magenta, Color.yellow, 0.5f)
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "NorGate",
                displayName = "或非门 (NOR)",
                category = "逻辑门",
                description = "或门后接非门",
                color = Color.Lerp(Color.cyan, Color.green, 0.5f)
            });

            RegisterComponent(new ComponentDefinition
            {
                name = "XorGate",
                displayName = "异或门 (XOR)",
                category = "逻辑门",
                description = "输入不同时输出高",
                color = Color.Lerp(Color.red, Color.green, 0.5f)
            });
        }

        private void RegisterComponent(ComponentDefinition definition)
        {
            builtInComponents[definition.name] = definition;
        }

        public bool RegisterCustomComponent(string scriptName, string displayName, string category, string description = "")
        {
            Type componentType = FindComponentType(scriptName);
            if (componentType == null || !componentType.IsSubclassOf(typeof(CircuitElement)))
            {
                Debug.LogError($"无法找到元件类型: {scriptName}，或该类型不是 CircuitElement 的子类");
                return false;
            }

            var definition = new ComponentDefinition
            {
                name = scriptName,
                displayName = displayName,
                category = category,
                description = description,
                componentType = componentType,
                color = Color.HSVToRGB(UnityEngine.Random.value, 0.7f, 0.9f)
            };

            customComponents[scriptName] = definition;

            if (!categories.Contains(category))
                categories.Add(category);

            Debug.Log($"成功注册自定义元件: {displayName} ({scriptName})");
            return true;
        }

        private Type FindComponentType(string typeName)
        {
            Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
            foreach (var assembly in assemblies)
            {
                Type type = assembly.GetType(typeName);
                if (type != null)
                    return type;

                type = assembly.GetType($"CircuitSimulator.Components.{typeName}");
                if (type != null)
                    return type;
            }
            return null;
        }

        public List<ComponentDefinition> GetComponentsByCategory(string category)
        {
            List<ComponentDefinition> result = new List<ComponentDefinition>();

            if (category == "全部")
            {
                result.AddRange(builtInComponents.Values);
                result.AddRange(customComponents.Values);
                return result;
            }

            foreach (var comp in builtInComponents.Values)
            {
                if (comp.category == category)
                    result.Add(comp);
            }
            foreach (var comp in customComponents.Values)
            {
                if (comp.category == category)
                    result.Add(comp);
            }
            return result;
        }

        public ComponentDefinition GetComponentDefinition(string name)
        {
            if (builtInComponents.TryGetValue(name, out var builtIn))
                return builtIn;
            if (customComponents.TryGetValue(name, out var custom))
                return custom;
            return null;
        }

        public List<string> GetCategories()
        {
            return new List<string>(categories);
        }

        public GameObject CreateComponent(string componentName, Vector2 position)
        {
            var definition = GetComponentDefinition(componentName);
            if (definition == null)
            {
                Debug.LogError($"找不到元件定义: {componentName}");
                return null;
            }

            GameObject obj = new GameObject(definition.displayName);
            obj.transform.position = position;

            Type componentType = definition.componentType ?? FindComponentType(componentName);
            if (componentType == null)
            {
                Debug.LogError($"无法创建元件: {componentName}，类型未找到");
                Destroy(obj);
                return null;
            }

            CircuitElement element = (CircuitElement)obj.AddComponent(componentType);

            foreach (var param in definition.defaultParameters)
            {
                element.SetParameter(param.Key, param.Value);
            }

            CircuitSimulator.Instance.RegisterElement(element);
            return obj;
        }

        public List<ComponentDefinition> GetCustomComponents()
        {
            return new List<ComponentDefinition>(customComponents.Values);
        }

        public void UnregisterCustomComponent(string name)
        {
            customComponents.Remove(name);
        }
    }
}
