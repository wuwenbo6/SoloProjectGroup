using UnityEngine;
using UnityEngine.UI;
using CircuitSimulator.Core;
using CircuitSimulator.Scene;

namespace CircuitSimulator.UI
{
    public class StatusDisplay : MonoBehaviour
    {
        [SerializeField] private Text statusText;
        [SerializeField] private Text elementStateText;
        [SerializeField] private GameObject statePanel;

        private ElementPlacementManager.PlacementMode lastMode;
        private CircuitElement lastSelectedElement;
        private int updateFrameInterval = 5;
        private int frameCounter;

        private void Start()
        {
            lastMode = (ElementPlacementManager.PlacementMode)(-1);
            UpdateStatusDisplay();
        }

        private void Update()
        {
            frameCounter++;
            if (frameCounter >= updateFrameInterval)
            {
                frameCounter = 0;
                UpdateStatusDisplay();
                UpdateElementStateDisplay();
            }
        }

        private void UpdateStatusDisplay()
        {
            var mode = ElementPlacementManager.Instance.GetCurrentMode();
            if (mode == lastMode) return;
            lastMode = mode;

            string modeText = mode switch
            {
                ElementPlacementManager.PlacementMode.Select => "选择模式",
                ElementPlacementManager.PlacementMode.Place => "放置元件",
                ElementPlacementManager.PlacementMode.Wire => "连接导线",
                ElementPlacementManager.PlacementMode.Delete => "删除模式",
                _ => ""
            };

            statusText.text = $"当前: {modeText}\n按 R 旋转选中元件\n右键取消\n元件数: {CircuitSimulator.Instance.GetElementCount()}";
        }

        private void UpdateElementStateDisplay()
        {
            var selectedElement = ElementPlacementManager.Instance.GetSelectedElement();

            if (selectedElement == null)
            {
                if (lastSelectedElement != null)
                {
                    statePanel.SetActive(false);
                    lastSelectedElement = null;
                }
                return;
            }

            if (selectedElement != lastSelectedElement)
            {
                statePanel.SetActive(true);
                lastSelectedElement = selectedElement;
            }

            elementStateText.text = selectedElement.GetStateDisplay();
        }
    }
}