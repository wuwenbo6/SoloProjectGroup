using UnityEngine;
using UnityEngine.UI;

namespace CircuitSimulator.UI
{
    public class OscilloscopeDisplay : MonoBehaviour
    {
        [SerializeField] private Oscilloscope oscilloscope;
        [SerializeField] private RawImage displayImage;
        [SerializeField] private int textureWidth = 800;
        [SerializeField] private int textureHeight = 400;
        [SerializeField] private Color backgroundColor = new Color(0.1f, 0.1f, 0.1f);
        [SerializeField] private Color gridColor = new Color(0.2f, 0.4f, 0.2f);

        private Texture2D displayTexture;

        private void Start()
        {
            InitializeTexture();
        }

        private void InitializeTexture()
        {
            displayTexture = new Texture2D(textureWidth, textureHeight);
            displayTexture.filterMode = FilterMode.Point;
            displayImage.texture = displayTexture;
        }

        private void Update()
        {
            if (oscilloscope != null)
            {
                RenderWaveform();
            }
        }

        private void RenderWaveform()
        {
            Color[] pixels = new Color[textureWidth * textureHeight];
            
            for (int i = 0; i < pixels.Length; i++)
            {
                pixels[i] = backgroundColor;
            }

            DrawGrid(pixels);

            for (int channel = 0; channel < oscilloscope.ChannelCount; channel++)
            {
                var oscChannel = oscilloscope.GetChannel(channel);
                if (!oscChannel.enabled) continue;

                var data = oscilloscope.GetDisplayData(channel);
                if (data.Count < 2) continue;

                DrawChannel(pixels, data, oscChannel.color, oscChannel.voltsPerDivision);
            }

            displayTexture.SetPixels(pixels);
            displayTexture.Apply();
        }

        private void DrawGrid(Color[] pixels)
        {
            int divisionsX = 10;
            int divisionsY = 8;

            for (int d = 1; d < divisionsX; d++)
            {
                int x = (d * textureWidth) / divisionsX;
                for (int y = 0; y < textureHeight; y++)
                {
                    int idx = y * textureWidth + x;
                    pixels[idx] = gridColor;
                }
            }

            for (int d = 1; d < divisionsY; d++)
            {
                int y = (d * textureHeight) / divisionsY;
                for (int x = 0; x < textureWidth; x++)
                {
                    int idx = y * textureWidth + x;
                    pixels[idx] = gridColor;
                }
            }

            int centerY = textureHeight / 2;
            for (int x = 0; x < textureWidth; x++)
            {
                int idx = centerY * textureWidth + x;
                pixels[idx] = new Color(0.3f, 0.6f, 0.3f);
            }
        }

        private void DrawChannel(Color[] pixels, System.Collections.Generic.List<float> data, Color color, float voltsPerDiv)
        {
            int centerY = textureHeight / 2;
            float pixelsPerVolt = (textureHeight / 8f) / voltsPerDiv;

            for (int i = 1; i < data.Count; i++)
            {
                float prevVoltage = data[i - 1];
                float currVoltage = data[i];

                if (float.IsNaN(prevVoltage) || float.IsNaN(currVoltage)) continue;

                int x0 = (i - 1) * textureWidth / System.Math.Max(data.Count, 1);
                int x1 = i * textureWidth / System.Math.Max(data.Count, 1);
                
                int y0 = centerY - (int)(prevVoltage * pixelsPerVolt);
                int y1 = centerY - (int)(currVoltage * pixelsPerVolt);

                DrawLine(pixels, x0, y0, x1, y1, color);
            }
        }

        private void DrawLine(Color[] pixels, int x0, int y0, int x1, int y1, Color color)
        {
            int dx = System.Math.Abs(x1 - x0);
            int dy = System.Math.Abs(y1 - y0);

            int sx = x0 < x1 ? 1 : -1;
            int sy = y0 < y1 ? 1 : -1;

            int err = dx - dy;

            while (true)
            {
                if (x0 >= 0 && x0 < textureWidth && y0 >= 0 && y0 < textureHeight)
                {
                    int idx = y0 * textureWidth + x0;
                    pixels[idx] = color;
                }

                if (x0 == x1 && y0 == y1) break;

                int e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 < dx) { err += dx; y0 += sy; }
            }
        }

        public void SetOscilloscope(Oscilloscope osc)
        {
            oscilloscope = osc;
        }
    }
}