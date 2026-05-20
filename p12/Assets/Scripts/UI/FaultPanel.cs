using UnityEngine;
using UnityEngine.UI;
using CircuitSimulator.Core;
using CircuitSimulator.Scene;

namespace CircuitSimulator.UI
{
    public class FaultPanel : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text elementNameText;
        [SerializeField] private Button noFaultButton;
        [SerializeField] private Button shortCircuitButton;
        [SerializeField] private Button openCircuitButton;
        [SerializeField] private Button driftFaultButton;
        [SerializeField] private Slider driftParameterSlider;
        [SerializeField] private Text driftParameterText;

        private CircuitElement currentElement;

        private void Start()
        {
            noFaultButton.onClick.AddListener(() => SetFault(CircuitElement.FaultType.None));
            shortCircuitButton.onClick.AddListener(() => SetFault(CircuitElement.FaultType.ShortCircuit));
            openCircuitButton.onClick.AddListener(() => SetFault(CircuitElement.FaultType.OpenCircuit));
            driftFaultButton.onClick.AddListener(() => SetFault(CircuitElement.FaultType.ParameterDrift));
            driftParameterSlider.onValueChanged.AddListener(OnDriftParameterChanged);
            
            panel.SetActive(false);
        }

        private void Update()
        {
            var selected = ElementPlacementManager.Instance.GetSelectedElement();
            if (selected != currentElement)
            {
                currentElement = selected;
                UpdatePanel();
            }
        }

        private void UpdatePanel()
        {
            if (currentElement == null)
            {
                panel.SetActive(false);
                return;
            }

            panel.SetActive(true);
            elementNameText.text = currentElement.GetType().Name;
            
            UpdateButtonStates();
        }

        private void UpdateButtonStates()
        {
            if (currentElement == null) return;

            Color normalColor = Color.white;
            Color selectedColor = Color.green;

            var colors = noFaultButton.colors;
            
            colors.normalColor = currentElement.CurrentFault == CircuitElement.FaultType.None ? selectedColor : normalColor;
            noFaultButton.colors = colors;
            
            colors.normalColor = currentElement.CurrentFault == CircuitElement.FaultType.ShortCircuit ? selectedColor : normalColor;
            shortCircuitButton.colors = colors;
            
            colors.normalColor = currentElement.CurrentFault == CircuitElement.FaultType.OpenCircuit ? selectedColor : normalColor;
            openCircuitButton.colors = colors;
            
            colors.normalColor = currentElement.CurrentFault == CircuitElement.FaultType.ParameterDrift ? selectedColor : normalColor;
            driftFaultButton.colors = colors;
        }

        private void SetFault(CircuitElement.FaultType faultType)
        {
            if (currentElement == null) return;

            if (faultType == CircuitElement.FaultType.ParameterDrift)
            {
                currentElement.SetFault(faultType, driftParameterSlider.value);
            }
            else
            {
                currentElement.SetFault(faultType);
            }

            UpdateButtonStates();
        }

        private void OnDriftParameterChanged(float value)
        {
            driftParameterText.text = $"{value:P0}";
            
            if (currentElement != null && currentElement.CurrentFault == CircuitElement.FaultType.ParameterDrift)
            {
                currentElement.SetFault(CircuitElement.FaultType.ParameterDrift, value);
            }
        }

        public void ClearFault()
        {
            if (currentElement != null)
            {
                currentElement.ClearFault();
                UpdateButtonStates();
            }
        }
    }
}