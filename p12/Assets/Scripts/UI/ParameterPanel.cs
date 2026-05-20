using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using CircuitSimulator.Core;
using CircuitSimulator.Scene;

namespace CircuitSimulator.UI
{
    public class ParameterPanel : MonoBehaviour
    {
        [SerializeField] private GameObject parameterPanel;
        [SerializeField] private Text elementNameText;
        [SerializeField] private Transform parametersContainer;
        [SerializeField] private GameObject parameterSliderPrefab;

        private CircuitElement currentElement;
        private List<SliderData> sliderDataList = new List<SliderData>();
        private int updateInterval = 10;
        private int frameCounter;

        private class SliderData
        {
            public Slider slider;
            public Text valueText;
            public string key;
            public float lastValue;
        }

        private void Update()
        {
            frameCounter++;
            if (frameCounter >= updateInterval)
            {
                frameCounter = 0;
                CheckSelectedElement();
            }
        }

        private void CheckSelectedElement()
        {
            var selectedElement = ElementPlacementManager.Instance.GetSelectedElement();
            if (selectedElement != currentElement)
            {
                currentElement = selectedElement;
                UpdatePanel();
            }
        }

        private void UpdatePanel()
        {
            foreach (var sliderData in sliderDataList)
            {
                Destroy(sliderData.slider.transform.parent.gameObject);
            }
            sliderDataList.Clear();

            if (currentElement == null)
            {
                parameterPanel.SetActive(false);
                return;
            }

            parameterPanel.SetActive(true);
            elementNameText.text = currentElement.GetType().Name;

            var parameters = currentElement.GetParameters();
            foreach (var param in parameters)
            {
                CreateParameterUI(param.Key, param.Value);
            }
        }

        private void CreateParameterUI(string key, object value)
        {
            GameObject paramUI = Instantiate(parameterSliderPrefab, parametersContainer);
            
            Text nameText = paramUI.transform.Find("NameText").GetComponent<Text>();
            Slider slider = paramUI.transform.Find("Slider").GetComponent<Slider>();
            Text valueText = paramUI.transform.Find("ValueText").GetComponent<Text>();

            nameText.text = key;

            if (value is float floatValue)
            {
                float min = 0f;
                float max = 100f;

                if (key.Contains("Voltage"))
                {
                    min = 0f;
                    max = 24f;
                }
                else if (key.Contains("Resistance"))
                {
                    min = 1f;
                    max = 10000f;
                }
                else if (key.Contains("Capacitance"))
                {
                    min = 0.0001f;
                    max = 0.1f;
                }

                slider.minValue = min;
                slider.maxValue = max;
                slider.value = floatValue;
                valueText.text = floatValue.ToString("F4");

                SliderData data = new SliderData
                {
                    slider = slider,
                    valueText = valueText,
                    key = key,
                    lastValue = floatValue
                };
                sliderDataList.Add(data);

                slider.onValueChanged.AddListener((newValue) =>
                {
                    currentElement.SetParameter(key, newValue);
                    valueText.text = newValue.ToString("F4");
                    data.lastValue = newValue;
                });
            }
        }
    }
}