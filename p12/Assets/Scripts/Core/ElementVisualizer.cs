using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Components;

namespace CircuitSimulator.Core
{
    public class ElementVisualizer : MonoBehaviour
    {
        public static ElementVisualizer Instance { get; private set; }

        [Header("Current Visualization")]
        [SerializeField] private Color lowCurrentColor = Color.cyan;
        [SerializeField] private Color highCurrentColor = Color.red;
        [SerializeField] private float maxCurrentThreshold = 5f;
        [SerializeField] private float baseEmission = 0.2f;
        [SerializeField] private float maxEmission = 2f;

        [Header("Voltage Visualization")]
        [SerializeField] private Color lowVoltageColor = Color.blue;
        [SerializeField] private Color highVoltageColor = Color.yellow;
        [SerializeField] private float maxVoltageThreshold = 12f;
        [SerializeField] private bool showVoltageGradient = true;

        [Header("Heat Visualization")]
        [SerializeField] private Color coolColor = new Color(0.3f, 0.3f, 1f);
        [SerializeField] private Color hotColor = new Color(1f, 0.2f, 0f);
        [SerializeField] private float maxPowerThreshold = 10f;
        [SerializeField] private float heatDissipationRate = 0.5f;

        [Header("Wire Animation")]
        [SerializeField] private bool enableCurrentFlow = true;
        [SerializeField] private float flowSpeedMultiplier = 2f;

        [Header("Performance")]
        [SerializeField] private float updateInterval = 0.1f;
        private float updateTimer;

        private Dictionary<CircuitElement, VisualState> elementStates = new Dictionary<CircuitElement, VisualState>();

        public class VisualState
        {
            public float normalizedCurrent;
            public float normalizedVoltage;
            public float normalizedPower;
            public float heatLevel;
            public float flowOffset;
            public Color baseColor;
            public bool isOverloaded;
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

        public void RegisterElement(CircuitElement element)
        {
            if (!elementStates.ContainsKey(element))
            {
                elementStates[element] = new VisualState
                {
                    baseColor = GetElementBaseColor(element)
                };
            }
        }

        public void UnregisterElement(CircuitElement element)
        {
            elementStates.Remove(element);
        }

        private Color GetElementBaseColor(CircuitElement element)
        {
            return element switch
            {
                VoltageSource => Color.red,
                Resistor => new Color(0.8f, 0.6f, 0.2f),
                Capacitor => Color.cyan,
                Inductor => Color.blue,
                Diode => Color.green,
                Wire => Color.gray,
                LogicGate => Color.magenta,
                _ => Color.white
            };
        }

        private void Update()
        {
            updateTimer += Time.deltaTime;
            if (updateTimer >= updateInterval)
            {
                UpdateVisualStates();
                updateTimer = 0f;
            }

            if (enableCurrentFlow)
            {
                UpdateFlowAnimation();
            }
        }

        private void UpdateVisualStates()
        {
            foreach (var kvp in elementStates)
            {
                var element = kvp.Key;
                var state = kvp.Value;

                float absCurrent = Mathf.Abs(element.Current);
                float absVoltage = Mathf.Abs(element.Voltage);
                float power = absCurrent * absVoltage;

                state.normalizedCurrent = Mathf.Clamp01(absCurrent / maxCurrentThreshold);
                state.normalizedVoltage = Mathf.Clamp01(absVoltage / maxVoltageThreshold);
                state.normalizedPower = Mathf.Clamp01(power / maxPowerThreshold);

                state.heatLevel = Mathf.Lerp(state.heatLevel, state.normalizedPower, 
                    Time.deltaTime * (state.normalizedPower > state.heatLevel ? 5f : heatDissipationRate));

                state.isOverloaded = state.normalizedPower > 0.9f;

                UpdateElementVisual(element, state);
            }
        }

        private void UpdateElementVisual(CircuitElement element, VisualState state)
        {
            var renderer = element.GetComponent<SpriteRenderer>();
            if (renderer == null) return;

            Color finalColor = CalculateElementColor(element, state);

            renderer.color = finalColor;

            if (element is Wire wire)
            {
                UpdateWireVisual(wire, state);
            }
            else if (element is Resistor resistor)
            {
                UpdateResistorVisual(resistor, state);
            }
            else if (element is Diode diode)
            {
                UpdateDiodeVisual(diode, state);
            }
            else if (element is VoltageSource vs)
            {
                UpdateVoltageSourceVisual(vs, state);
            }
        }

        private Color CalculateElementColor(CircuitElement element, VisualState state)
        {
            Color color = state.baseColor;

            color = Color.Lerp(color, highCurrentColor, state.normalizedCurrent * 0.5f);

            color = Color.Lerp(color, hotColor, state.heatLevel * 0.8f);

            float brightness = 1f + state.normalizedCurrent * baseEmission;
            color = new Color(
                Mathf.Min(color.r * brightness, 1f),
                Mathf.Min(color.g * brightness, 1f),
                Mathf.Min(color.b * brightness, 1f),
                color.a
            );

            if (state.isOverloaded)
            {
                float pulse = 0.5f + 0.5f * Mathf.Sin(Time.time * 8f);
                color = Color.Lerp(color, Color.red, pulse * 0.3f);
            }

            return color;
        }

        private void UpdateWireVisual(Wire wire, VisualState state)
        {
            var lineRenderer = wire.GetComponent<LineRenderer>();
            if (lineRenderer == null) return;

            Color wireColor = Color.Lerp(lowCurrentColor, highCurrentColor, state.normalizedCurrent);
            float brightness = 1f + state.normalizedCurrent * 0.5f;
            wireColor = new Color(wireColor.r * brightness, wireColor.g * brightness, wireColor.b * brightness);

            float glowIntensity = state.heatLevel * 0.5f;
            wireColor = Color.Lerp(wireColor, hotColor, glowIntensity);

            if (enableCurrentFlow)
            {
                state.flowOffset += state.normalizedCurrent * flowSpeedMultiplier * Time.deltaTime;
                if (state.flowOffset > 1f) state.flowOffset -= 1f;

                lineRenderer.material.mainTextureOffset = new Vector2(state.flowOffset, 0f);
            }

            lineRenderer.startColor = wireColor;
            lineRenderer.endColor = wireColor;

            float baseWidth = 0.05f;
            float widthScale = 1f + state.normalizedCurrent * 0.5f;
            lineRenderer.startWidth = baseWidth * widthScale;
            lineRenderer.endWidth = baseWidth * widthScale;
        }

        private void UpdateResistorVisual(Resistor resistor, VisualState state)
        {
            var renderer = resistor.GetComponent<SpriteRenderer>();
            if (renderer == null) return;

            Color resistorColor = Color.Lerp(new Color(0.8f, 0.6f, 0.2f), hotColor, state.heatLevel);
            
            float saturation = 1f + state.normalizedCurrent * 0.3f;
            resistorColor = Color.Lerp(Color.gray, resistorColor, saturation);

            renderer.color = resistorColor;

            if (state.isOverloaded)
            {
                float smokeAlpha = (state.heatLevel - 0.9f) * 5f;
                var particles = resistor.GetComponent<ParticleSystem>();
                if (particles != null && smokeAlpha > 0)
                {
                    var emission = particles.emission;
                    emission.rateOverTime = smokeAlpha * 10f;
                    if (!particles.isPlaying) particles.Play();
                }
            }
        }

        private void UpdateDiodeVisual(Diode diode, VisualState state)
        {
            var renderer = diode.GetComponent<SpriteRenderer>();
            if (renderer == null) return;

            bool isForwardBiased = diode.Current > 0.001f;

            Color diodeColor;
            if (isForwardBiased)
            {
                diodeColor = Color.Lerp(Color.green, Color.yellow, state.normalizedCurrent);
                float glow = 1f + state.normalizedCurrent * maxEmission;
                diodeColor = new Color(diodeColor.r * glow, diodeColor.g * glow, diodeColor.b * glow);
            }
            else
            {
                diodeColor = new Color(0.3f, 0.5f, 0.3f);
            }

            renderer.color = diodeColor;
        }

        private void UpdateVoltageSourceVisual(VoltageSource vs, VisualState state)
        {
            var renderer = vs.GetComponent<SpriteRenderer>();
            if (renderer == null) return;

            Color sourceColor = Color.Lerp(Color.red, Color.yellow, state.normalizedVoltage * 0.5f);
            
            float pulse = 1f + 0.2f * Mathf.Sin(Time.time * 2f);
            sourceColor = new Color(sourceColor.r * pulse, sourceColor.g * pulse, sourceColor.b * pulse);

            renderer.color = sourceColor;
        }

        private void UpdateFlowAnimation()
        {
            foreach (var kvp in elementStates)
            {
                if (kvp.Key is Wire wire)
                {
                    var state = kvp.Value;
                    var lineRenderer = wire.GetComponent<LineRenderer>();
                    if (lineRenderer != null && lineRenderer.material != null)
                    {
                        state.flowOffset += state.normalizedCurrent * flowSpeedMultiplier * Time.deltaTime;
                        if (state.flowOffset > 1f) state.flowOffset -= 1f;
                        lineRenderer.material.mainTextureOffset = new Vector2(state.flowOffset, 0f);
                    }
                }
            }
        }

        public void SetColorIntensity(float intensity)
        {
            baseEmission = Mathf.Max(0f, intensity);
        }

        public void SetMaxCurrentThreshold(float threshold)
        {
            maxCurrentThreshold = Mathf.Max(0.1f, threshold);
        }

        public VisualState GetElementState(CircuitElement element)
        {
            return elementStates.TryGetValue(element, out var state) ? state : null;
        }

        public float GetAverageHeatLevel()
        {
            if (elementStates.Count == 0) return 0f;

            float total = 0f;
            foreach (var state in elementStates.Values)
            {
                total += state.heatLevel;
            }
            return total / elementStates.Count;
        }

        public int GetOverloadedElementCount()
        {
            int count = 0;
            foreach (var state in elementStates.Values)
            {
                if (state.isOverloaded) count++;
            }
            return count;
        }

        public void ResetAllVisuals()
        {
            foreach (var kvp in elementStates)
            {
                var element = kvp.Key;
                var renderer = element.GetComponent<SpriteRenderer>();
                if (renderer != null)
                {
                    renderer.color = kvp.Value.baseColor;
                }
            }
        }
    }
}
