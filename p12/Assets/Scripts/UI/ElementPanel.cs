using UnityEngine;
using UnityEngine.UI;
using CircuitSimulator.Core;
using CircuitSimulator.Components;
using CircuitSimulator.Scene;

namespace CircuitSimulator.UI
{
    public class ElementPanel : MonoBehaviour
    {
        [SerializeField] private Button voltageSourceButton;
        [SerializeField] private Button resistorButton;
        [SerializeField] private Button capacitorButton;
        [SerializeField] private Button diodeButton;
        [SerializeField] private Button wireButton;
        [SerializeField] private Button selectButton;
        [SerializeField] private Button deleteButton;

        [SerializeField] private Color selectedColor = Color.green;
        [SerializeField] private Color normalColor = Color.white;

        private Button currentSelectedButton;

        private void Start()
        {
            voltageSourceButton.onClick.AddListener(() => SelectElement(typeof(VoltageSource), voltageSourceButton));
            resistorButton.onClick.AddListener(() => SelectElement(typeof(Resistor), resistorButton));
            capacitorButton.onClick.AddListener(() => SelectElement(typeof(Capacitor), capacitorButton));
            diodeButton.onClick.AddListener(() => SelectElement(typeof(Diode), diodeButton));
            wireButton.onClick.AddListener(() => SelectWireMode());
            selectButton.onClick.AddListener(() => SelectMode());
            deleteButton.onClick.AddListener(() => DeleteMode());
        }

        private void SelectElement(System.Type elementType, Button button)
        {
            UpdateSelectedButton(button);
            ElementPlacementManager.Instance.SetPlacementMode(
                ElementPlacementManager.PlacementMode.Place,
                elementType
            );
        }

        private void SelectWireMode()
        {
            UpdateSelectedButton(wireButton);
            ElementPlacementManager.Instance.SetPlacementMode(
                ElementPlacementManager.PlacementMode.Wire
            );
        }

        private void SelectMode()
        {
            UpdateSelectedButton(selectButton);
            ElementPlacementManager.Instance.SetPlacementMode(
                ElementPlacementManager.PlacementMode.Select
            );
        }

        private void DeleteMode()
        {
            UpdateSelectedButton(deleteButton);
            ElementPlacementManager.Instance.SetPlacementMode(
                ElementPlacementManager.PlacementMode.Delete
            );
        }

        private void UpdateSelectedButton(Button newButton)
        {
            if (currentSelectedButton != null)
            {
                var colors = currentSelectedButton.colors;
                colors.normalColor = normalColor;
                currentSelectedButton.colors = colors;
            }

            currentSelectedButton = newButton;

            if (currentSelectedButton != null)
            {
                var colors = currentSelectedButton.colors;
                colors.normalColor = selectedColor;
                currentSelectedButton.colors = colors;
            }
        }
    }
}