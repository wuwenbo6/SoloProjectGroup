using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

namespace CircuitSimulator.SaveLoad
{
    public class SaveLoadUI : MonoBehaviour
    {
        [SerializeField] private InputField fileNameInput;
        [SerializeField] private Button saveButton;
        [SerializeField] private Button loadButton;
        [SerializeField] private Transform saveListContainer;
        [SerializeField] private GameObject saveItemPrefab;

        private string selectedFileName;

        private void Start()
        {
            saveButton.onClick.AddListener(OnSaveClicked);
            loadButton.onClick.AddListener(OnLoadClicked);
            RefreshSaveList();
        }

        private void OnEnable()
        {
            RefreshSaveList();
        }

        private void OnSaveClicked()
        {
            string fileName = fileNameInput.text.Trim();
            if (string.IsNullOrEmpty(fileName))
            {
                fileName = "Circuit_" + System.DateTime.Now.ToString("yyyyMMdd_HHmmss");
            }
            SaveLoadManager.Instance.SaveCircuit(fileName);
            RefreshSaveList();
        }

        private void OnLoadClicked()
        {
            string fileName = fileNameInput.text.Trim();
            if (!string.IsNullOrEmpty(fileName))
            {
                SaveLoadManager.Instance.LoadCircuit(fileName);
            }
        }

        private void RefreshSaveList()
        {
            foreach (Transform child in saveListContainer)
            {
                Destroy(child.gameObject);
            }

            List<string> saveFiles = SaveLoadManager.Instance.GetSaveFiles();
            foreach (string fileName in saveFiles)
            {
                GameObject item = Instantiate(saveItemPrefab, saveListContainer);
                Text nameText = item.transform.Find("FileName").GetComponent<Text>();
                Button loadBtn = item.transform.Find("LoadButton").GetComponent<Button>();
                Button deleteBtn = item.transform.Find("DeleteButton").GetComponent<Button>();

                nameText.text = fileName;
                loadBtn.onClick.AddListener(() =>
                {
                    fileNameInput.text = fileName;
                    selectedFileName = fileName;
                });
                deleteBtn.onClick.AddListener(() =>
                {
                    SaveLoadManager.Instance.DeleteSave(fileName);
                    RefreshSaveList();
                });
            }
        }
    }
}