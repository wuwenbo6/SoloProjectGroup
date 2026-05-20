using UnityEngine;
using TieDyeGame.Performance;

namespace TieDyeGame.Core
{
    public class TieDyeSimulation : MonoBehaviour
    {
        [Header("Simulation Settings")]
        [SerializeField] private int gridSize = 128;
        [SerializeField] private float diffusionRate = 0.08f;
        [SerializeField] private float evaporationRate = 0.005f;
        [SerializeField] private float capillaryStrength = 0.12f;
        [SerializeField] private float colorSaturationPreservation = 0.85f;
        [SerializeField] private int simulationUpdateInterval = 2;
        [SerializeField] private bool usePerformanceManager = true;
        
        private Color[,] _colorGrid;
        private float[,] _wetnessGrid;
        private float[,] _dyeConcentrationGrid;
        private bool[,] _tieMask;
        private float[,] _fiberDirectionMap;
        private Texture2D _renderTexture;
        private bool _isSimulating;
        private int _frameCounter;
        private float _updateTimer;

        private void Awake()
        {
            if (usePerformanceManager && PerformanceManager.Instance != null)
            {
                gridSize = PerformanceManager.Instance.GetRecommendedGridSize();
                simulationUpdateInterval = Mathf.CeilToInt(PerformanceManager.Instance.GetSimulationUpdateInterval() / Time.fixedDeltaTime);
                
                PerformanceManager.Instance.OnPerformanceLevelChanged += OnPerformanceLevelChanged;
            }
            
            InitializeGrid();
            GenerateFiberDirectionMap();
        }

        private void OnPerformanceLevelChanged(PerformanceLevel level)
        {
            if (!usePerformanceManager) return;
            
            var settings = PerformanceManager.Instance.GetCurrentSettings();
            if (settings != null)
            {
                gridSize = settings.simulationGridSize;
                simulationUpdateInterval = Mathf.CeilToInt(settings.simulationUpdateInterval / Time.fixedDeltaTime);
                InitializeGrid();
                GenerateFiberDirectionMap();
            }
        }

        private void InitializeGrid()
        {
            _colorGrid = new Color[gridSize, gridSize];
            _wetnessGrid = new float[gridSize, gridSize];
            _dyeConcentrationGrid = new float[gridSize, gridSize];
            _tieMask = new bool[gridSize, gridSize];
            _fiberDirectionMap = new float[gridSize, gridSize];
            
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    _colorGrid[x, y] = Color.white;
                    _wetnessGrid[x, y] = 0f;
                    _dyeConcentrationGrid[x, y] = 0f;
                    _tieMask[x, y] = false;
                }
            }
            
            _renderTexture = new Texture2D(gridSize, gridSize)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            
            UpdateTexture();
        }

        private void GenerateFiberDirectionMap()
        {
            var seed = Random.Range(0f, 100f);
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var noise = Mathf.PerlinNoise(x * 0.1f + seed, y * 0.1f + seed);
                    _fiberDirectionMap[x, y] = noise * Mathf.PI * 2f;
                }
            }
        }

        public void ApplyTiePattern(Materials.TiePattern pattern)
        {
            ResetTieMask();
            pattern.ApplyToMask(_tieMask, gridSize);
        }

        private void ResetTieMask()
        {
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    _tieMask[x, y] = false;
                }
            }
        }

        public void ApplyDye(Vector2 center, Color color, float radius, float intensity)
        {
            var centerX = Mathf.FloorToInt(center.x * gridSize);
            var centerY = Mathf.FloorToInt(center.y * gridSize);
            var pixelRadius = Mathf.FloorToInt(radius * gridSize);

            for (var x = centerX - pixelRadius; x <= centerX + pixelRadius; x++)
            {
                for (var y = centerY - pixelRadius; y <= centerY + pixelRadius; y++)
                {
                    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
                    if (_tieMask[x, y]) continue;

                    var distance = Vector2.Distance(new Vector2(x, y), new Vector2(centerX, centerY));
                    if (distance > pixelRadius) continue;

                    var falloff = Mathf.Pow(1f - (distance / pixelRadius), 1.5f);
                    var finalIntensity = intensity * falloff;
                    
                    var preservedColor = PreserveColorSaturation(_colorGrid[x, y], color, finalIntensity);
                    _colorGrid[x, y] = preservedColor;
                    _wetnessGrid[x, y] = Mathf.Min(1f, _wetnessGrid[x, y] + finalIntensity * 0.6f);
                    _dyeConcentrationGrid[x, y] = Mathf.Min(1f, _dyeConcentrationGrid[x, y] + finalIntensity);
                }
            }
            
            UpdateTexture();
        }

        private Color PreserveColorSaturation(Color baseColor, Color dyeColor, float intensity)
        {
            if (baseColor == Color.white)
            {
                return Color.Lerp(baseColor, dyeColor, intensity);
            }

            var baseHsv = ColorToHSV(baseColor);
            var dyeHsv = ColorToHSV(dyeColor);
            
            var hueDiff = Mathf.Abs(baseHsv.x - dyeHsv.x);
            var hueDiffAlt = Mathf.Abs(baseHsv.x - dyeHsv.x + 1f);
            var hueDiffAlt2 = Mathf.Abs(baseHsv.x - dyeHsv.x - 1f);
            var minHueDiff = Mathf.Min(hueDiff, hueDiffAlt, hueDiffAlt2);

            float finalH, finalS, finalV;
            
            if (minHueDiff < 0.3f)
            {
                finalH = Mathf.Lerp(baseHsv.x, dyeHsv.x, intensity * 0.7f);
                finalS = Mathf.Max(baseHsv.y, dyeHsv.y * intensity) * colorSaturationPreservation;
            }
            else
            {
                finalH = dyeHsv.x;
                finalS = Mathf.Lerp(baseHsv.y, dyeHsv.y, intensity * 0.5f);
            }
            
            finalV = Mathf.Lerp(baseHsv.z, dyeHsv.z, intensity * 0.3f);
            
            return HSVToColor(finalH, finalS, Mathf.Max(finalV, 0.7f));
        }

        private Vector3 ColorToHSV(Color color)
        {
            Color.RGBToHSV(color, out var h, out var s, out var v);
            return new Vector3(h, s, v);
        }

        private Color HSVToColor(float h, float s, float v)
        {
            return Color.HSVToRGB(h, s, v);
        }

        public void StartSimulation()
        {
            _isSimulating = true;
            _frameCounter = 0;
        }

        public void StopSimulation()
        {
            _isSimulating = false;
        }

        private void Update()
        {
            if (_isSimulating)
            {
                _frameCounter++;
                if (_frameCounter >= simulationUpdateInterval)
                {
                    StepSimulation();
                    _frameCounter = 0;
                }
            }
        }

        private void StepSimulation()
        {
            var newColorGrid = (Color[,])_colorGrid.Clone();
            var newWetnessGrid = (float[,])_wetnessGrid.Clone();
            var newConcentrationGrid = (float[,])_dyeConcentrationGrid.Clone();

            for (var x = 1; x < gridSize - 1; x++)
            {
                for (var y = 1; y < gridSize - 1; y++)
                {
                    if (_tieMask[x, y]) continue;
                    if (_wetnessGrid[x, y] <= 0.01f) continue;

                    DiffuseWithCapillary(x, y, newColorGrid, newWetnessGrid, newConcentrationGrid);
                }
            }

            _colorGrid = newColorGrid;
            _wetnessGrid = newWetnessGrid;
            _dyeConcentrationGrid = newConcentrationGrid;

            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    _wetnessGrid[x, y] = Mathf.Max(0f, _wetnessGrid[x, y] - evaporationRate);
                }
            }
            
            UpdateTexture();
        }

        private void DiffuseWithCapillary(int x, int y, Color[,] newColorGrid, float[,] newWetnessGrid, float[,] newConcentrationGrid)
        {
            var direction = _fiberDirectionMap[x, y];
            
            var neighbors = new[]
            {
                (x - 1, y, 1f),
                (x + 1, y, 1f),
                (x, y - 1, 1f),
                (x, y + 1, 1f),
                (x + Mathf.FloorToInt(Mathf.Cos(direction)), 
                 y + Mathf.FloorToInt(Mathf.Sin(direction)), capillaryStrength),
                (x - Mathf.FloorToInt(Mathf.Cos(direction)), 
                 y - Mathf.FloorToInt(Mathf.Sin(direction)), capillaryStrength)
            };

            foreach (var (nx, ny, strength) in neighbors)
            {
                if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
                if (_tieMask[nx, ny]) continue;
                
                var wetnessDiff = _wetnessGrid[x, y] - _wetnessGrid[nx, ny];
                if (wetnessDiff <= 0) continue;

                var concentrationGradient = _dyeConcentrationGrid[x, y] - _dyeConcentrationGrid[nx, ny];
                var gradientFactor = 1f + Mathf.Max(0f, concentrationGradient) * 0.5f;
                
                var transferAmount = wetnessDiff * diffusionRate * strength * gradientFactor;
                transferAmount = Mathf.Min(transferAmount, _wetnessGrid[x, y] * 0.3f);
                
                if (transferAmount <= 0) continue;

                var sourceColor = _colorGrid[x, y];
                var targetColor = _colorGrid[nx, ny];
                
                var mixedColor = BlendColorsNatural(targetColor, sourceColor, transferAmount);
                newColorGrid[nx, ny] = mixedColor;
                
                newWetnessGrid[nx, ny] = Mathf.Min(1f, newWetnessGrid[nx, ny] + transferAmount);
                newWetnessGrid[x, y] = Mathf.Max(0f, newWetnessGrid[x, y] - transferAmount);
                
                var concentrationTransfer = transferAmount * _dyeConcentrationGrid[x, y];
                newConcentrationGrid[nx, ny] = Mathf.Min(1f, newConcentrationGrid[nx, ny] + concentrationTransfer);
            }
        }

        private Color BlendColorsNatural(Color baseColor, Color dyeColor, float amount)
        {
            if (amount <= 0) return baseColor;
            if (baseColor == Color.white)
            {
                return Color.Lerp(baseColor, dyeColor, amount);
            }

            var baseHsv = ColorToHSV(baseColor);
            var dyeHsv = ColorToHSV(dyeColor);
            
            var hueDistance = Mathf.Abs(baseHsv.x - dyeHsv.x);
            hueDistance = Mathf.Min(hueDistance, 1f - hueDistance);
            
            float finalH, finalS, finalV;
            
            if (hueDistance < 0.4f)
            {
                finalH = Mathf.Lerp(baseHsv.x, dyeHsv.x, amount * 0.6f);
                finalS = Mathf.Lerp(baseHsv.y, dyeHsv.y, amount * 0.4f);
            }
            else
            {
                finalH = dyeHsv.x > baseHsv.x ? 
                    Mathf.Lerp(baseHsv.x, dyeHsv.x, amount * 0.3f) : 
                    Mathf.Lerp(dyeHsv.x, baseHsv.x, 1f - amount * 0.3f);
                finalS = Mathf.Max(baseHsv.y, dyeHsv.y * amount) * colorSaturationPreservation;
            }
            
            finalV = Mathf.Lerp(baseHsv.z, dyeHsv.z, amount * 0.2f);
            
            return HSVToColor(finalH, Mathf.Clamp01(finalS), Mathf.Clamp(finalV, 0.6f, 1f));
        }

        private void UpdateTexture()
        {
            for (var x = 0; x < gridSize; x++)
            {
                for (var y = 0; y < gridSize; y++)
                {
                    var pixelColor = _tieMask[x, y] ? new Color(0.3f, 0.3f, 0.3f) : _colorGrid[x, y];
                    _renderTexture.SetPixel(x, y, pixelColor);
                }
            }
            _renderTexture.Apply(false);
        }

        public Texture2D GetRenderTexture() => _renderTexture;
        
        public Color[,] GetColorGrid() => (Color[,])_colorGrid.Clone();
        
        public void ResetSimulation()
        {
            InitializeGrid();
            GenerateFiberDirectionMap();
        }

        public void SetGridSize(int size)
        {
            gridSize = Mathf.Clamp(size, 32, 256);
            InitializeGrid();
            GenerateFiberDirectionMap();
        }

        public bool IsSimulating() => _isSimulating;

        public void Cleanup()
        {
            if (_renderTexture != null)
            {
                Destroy(_renderTexture);
                _renderTexture = null;
            }

            _colorGrid = null;
            _wetnessGrid = null;
            _dyeConcentrationGrid = null;
            _tieMask = null;
            _fiberDirectionMap = null;
        }

        private void OnDestroy()
        {
            if (usePerformanceManager && PerformanceManager.Instance != null)
            {
                PerformanceManager.Instance.OnPerformanceLevelChanged -= OnPerformanceLevelChanged;
            }
            
            Cleanup();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                StopSimulation();
            }
        }
    }
}