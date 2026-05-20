using UnityEngine;
using System;
using System.Collections.Generic;
using System.IO;
using CircuitSimulator.Core;
using CircuitSimulator.Components;

namespace CircuitSimulator.SaveLoad
{
    public class SaveLoadManager : MonoBehaviour
    {
        public static SaveLoadManager Instance { get; private set; }

        private string saveDirectory;

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

            saveDirectory = Path.Combine(Application.persistentDataPath, "CircuitSaves");
            if (!Directory.Exists(saveDirectory))
            {
                Directory.CreateDirectory(saveDirectory);
            }
        }

        public void SaveCircuit(string fileName)
        {
            CircuitSaveData saveData = new CircuitSaveData();
            saveData.SaveTime = DateTime.Now.ToString();

            var elements = CircuitSimulator.Instance.GetAllElements();
            foreach (var element in elements)
            {
                ElementSaveData elementData = new ElementSaveData
                {
                    ElementType = element.GetType().AssemblyQualifiedName,
                    PositionX = element.transform.position.x,
                    PositionY = element.transform.position.y,
                    RotationZ = element.transform.eulerAngles.z
                };

                var paramDict = element.GetParameters();
                foreach (var param in paramDict)
                {
                    elementData.ParameterKeys.Add(param.Key);
                    elementData.ParameterValues.Add(Convert.ToSingle(param.Value));
                }

                saveData.Elements.Add(elementData);
            }

            string json = JsonUtility.ToJson(saveData, true);
            string filePath = Path.Combine(saveDirectory, fileName + ".json");
            File.WriteAllText(filePath, json);

            Debug.Log($"电路已保存到: {filePath}");
        }

        public void LoadCircuit(string fileName)
        {
            string filePath = Path.Combine(saveDirectory, fileName + ".json");
            if (!File.Exists(filePath))
            {
                Debug.LogWarning($"存档文件不存在: {filePath}");
                return;
            }

            ClearCurrentCircuit();

            string json = File.ReadAllText(filePath);
            CircuitSaveData saveData = JsonUtility.FromJson<CircuitSaveData>(json);

            foreach (var elementData in saveData.Elements)
            {
                Type elementType = Type.GetType(elementData.ElementType);
                if (elementType == null) continue;

                GameObject elementObj = new GameObject(elementType.Name);
                CircuitElement element = (CircuitElement)elementObj.AddComponent(elementType);

                elementObj.transform.position = new Vector2(elementData.PositionX, elementData.PositionY);
                elementObj.transform.eulerAngles = new Vector3(0, 0, elementData.RotationZ);

                for (int i = 0; i < elementData.ParameterKeys.Count; i++)
                {
                    element.SetParameter(elementData.ParameterKeys[i], elementData.ParameterValues[i]);
                }

                CircuitSimulator.Instance.RegisterElement(element);
            }

            Debug.Log($"电路已从 {filePath} 加载");
        }

        private void ClearCurrentCircuit()
        {
            var elements = CircuitSimulator.Instance.GetAllElements();
            foreach (var element in elements)
            {
                Destroy(element.gameObject);
            }
            CircuitSimulator.Instance.ClearCircuit();
        }

        public List<string> GetSaveFiles()
        {
            List<string> saveFiles = new List<string>();
            if (Directory.Exists(saveDirectory))
            {
                string[] files = Directory.GetFiles(saveDirectory, "*.json");
                foreach (string file in files)
                {
                    saveFiles.Add(Path.GetFileNameWithoutExtension(file));
                }
            }
            return saveFiles;
        }

        public void DeleteSave(string fileName)
        {
            string filePath = Path.Combine(saveDirectory, fileName + ".json");
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
    }

    [Serializable]
    public class CircuitSaveData
    {
        public string SaveTime;
        public List<ElementSaveData> Elements = new List<ElementSaveData>();
    }

    [Serializable]
    public class ElementSaveData
    {
        public string ElementType;
        public float PositionX;
        public float PositionY;
        public float RotationZ;
        public List<string> ParameterKeys = new List<string>();
        public List<float> ParameterValues = new List<float>();
    }
}