using UnityEngine;
using System.Collections.Generic;
using CircuitSimulator.Core;

namespace CircuitSimulator.UI
{
    public class Oscilloscope : MonoBehaviour
    {
        [System.Serializable]
        public class Channel
        {
            public bool enabled = true;
            public Color color = Color.cyan;
            public float voltsPerDivision = 1f;
            public List<float> dataPoints = new List<float>();
            public CircuitNode monitoredNode;
            public string name;
        }

        [SerializeField] private int maxDataPoints = 500;
        [SerializeField] private float timeBase = 0.01f;
        [SerializeField] private bool autoTrigger = true;
        [SerializeField] private float triggerLevel = 2.5f;

        [SerializeField] private List<Channel> channels = new List<Channel>();

        private float sampleTimer;
        private int triggerIndex;
        private bool triggered;

        public int ChannelCount => channels.Count;
        public float TimeBase { get => timeBase; set => timeBase = Mathf.Max(0.001f, value); }

        private void Start()
        {
            CircuitSimulator.OnSimulationStep += OnSimulationStep;
            
            while (channels.Count < 4)
            {
                channels.Add(new Channel
                {
                    name = $"通道 {channels.Count + 1}",
                    color = GetDefaultColor(channels.Count)
                });
            }
        }

        private Color GetDefaultColor(int index)
        {
            return index switch
            {
                0 => Color.cyan,
                1 => Color.yellow,
                2 => Color.magenta,
                3 => Color.green,
                _ => Color.white
            };
        }

        private void OnSimulationStep()
        {
            float deltaTime = CircuitSimulator.Instance ? 0.033f : 0.033f;
            sampleTimer += deltaTime;

            if (sampleTimer >= timeBase)
            {
                sampleTimer = 0f;
                SampleAllChannels();
            }
        }

        private void SampleAllChannels()
        {
            foreach (var channel in channels)
            {
                if (!channel.enabled || channel.monitoredNode == null)
                {
                    channel.dataPoints.Add(float.NaN);
                }
                else
                {
                    channel.dataPoints.Add(channel.monitoredNode.Voltage);
                }

                while (channel.dataPoints.Count > maxDataPoints)
                {
                    channel.dataPoints.RemoveAt(0);
                }
            }

            if (autoTrigger)
            {
                CheckTrigger();
            }
        }

        private void CheckTrigger()
        {
            var triggerChannel = channels.Find(c => c.enabled && c.monitoredNode != null);
            if (triggerChannel == null || triggerChannel.dataPoints.Count < 2) return;

            int lastIdx = triggerChannel.dataPoints.Count - 1;
            float prev = triggerChannel.dataPoints[lastIdx - 1];
            float curr = triggerChannel.dataPoints[lastIdx];

            if (!float.IsNaN(prev) && !float.IsNaN(curr) &&
                prev < triggerLevel && curr >= triggerLevel)
            {
                triggered = true;
                triggerIndex = lastIdx;
            }
        }

        public void SetMonitoredNode(int channelIndex, CircuitNode node)
        {
            if (channelIndex >= 0 && channelIndex < channels.Count)
            {
                channels[channelIndex].monitoredNode = node;
                channels[channelIndex].dataPoints.Clear();
            }
        }

        public void SetChannelEnabled(int channelIndex, bool enabled)
        {
            if (channelIndex >= 0 && channelIndex < channels.Count)
            {
                channels[channelIndex].enabled = enabled;
            }
        }

        public void SetVoltsPerDivision(int channelIndex, float volts)
        {
            if (channelIndex >= 0 && channelIndex < channels.Count)
            {
                channels[channelIndex].voltsPerDivision = Mathf.Max(0.1f, volts);
            }
        }

        public void SetTriggerLevel(float level)
        {
            triggerLevel = level;
        }

        public void ClearDisplay()
        {
            foreach (var channel in channels)
            {
                channel.dataPoints.Clear();
            }
            triggered = false;
            triggerIndex = 0;
        }

        public Channel GetChannel(int index)
        {
            if (index >= 0 && index < channels.Count)
            {
                return channels[index];
            }
            return null;
        }

        public List<float> GetDisplayData(int channelIndex)
        {
            var channel = GetChannel(channelIndex);
            if (channel == null) return new List<float>();

            if (!triggered || channel.dataPoints.Count == 0)
            {
                return new List<float>(channel.dataPoints);
            }

            int startIdx = Mathf.Max(0, triggerIndex - maxDataPoints / 2);
            int count = Mathf.Min(channel.dataPoints.Count - startIdx, maxDataPoints);
            return channel.dataPoints.GetRange(startIdx, count);
        }

        public float GetFrequency(int channelIndex)
        {
            var channel = GetChannel(channelIndex);
            if (channel == null || channel.dataPoints.Count < 10) return 0f;

            int zeroCrossings = 0;
            for (int i = 1; i < channel.dataPoints.Count; i++)
            {
                float prev = channel.dataPoints[i - 1];
                float curr = channel.dataPoints[i];
                if (!float.IsNaN(prev) && !float.IsNaN(curr) &&
                    (prev - triggerLevel) * (curr - triggerLevel) < 0)
                {
                    zeroCrossings++;
                }
            }

            float totalTime = channel.dataPoints.Count * timeBase;
            return (zeroCrossings / 2f) / totalTime;
        }

        public float GetVoltageAverage(int channelIndex)
        {
            var channel = GetChannel(channelIndex);
            if (channel == null || channel.dataPoints.Count == 0) return 0f;

            float sum = 0f;
            int count = 0;
            foreach (float v in channel.dataPoints)
            {
                if (!float.IsNaN(v))
                {
                    sum += v;
                    count++;
                }
            }
            return count > 0 ? sum / count : 0f;
        }

        public float GetVoltagePeak(int channelIndex)
        {
            var channel = GetChannel(channelIndex);
            if (channel == null || channel.dataPoints.Count == 0) return 0f;

            float max = float.MinValue;
            foreach (float v in channel.dataPoints)
            {
                if (!float.IsNaN(v) && v > max) max = v;
            }
            return max != float.MinValue ? max : 0f;
        }

        private void OnDestroy()
        {
            CircuitSimulator.OnSimulationStep -= OnSimulationStep;
        }
    }
}