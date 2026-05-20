export function generateWaveformData(
  audioData: Float32Array[],
  targetWidth: number = 1000
): number[] {
  if (audioData.length === 0 || audioData[0].length === 0) {
    return new Array(targetWidth).fill(0);
  }

  const samples = audioData[0];
  const samplesPerPixel = Math.floor(samples.length / targetWidth);
  const waveform = new Array(targetWidth).fill(0);
  
  for (let i = 0; i < targetWidth; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, samples.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      max = Math.max(max, Math.abs(samples[j]));
    }
    waveform[i] = max;
  }
  
  return waveform;
}

export function renderWaveformCanvas(
  canvas: HTMLCanvasElement,
  waveformData: number[],
  color: string = '#3b82f6',
  bgColor: string = '#1f2937'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = color;
  const barWidth = width / waveformData.length;
  for (let i = 0; i < waveformData.length; i++) {
    const barHeight = waveformData[i] * centerY * 0.9;
    ctx.fillRect(
      i * barWidth,
      centerY - barHeight,
      Math.max(1, barWidth - 1),
      barHeight * 2
    );
  }
}

export function renderSpectrumCanvas(
  canvas: HTMLCanvasElement,
  spectrum: Float32Array,
  _sampleRate: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, width, height);

  const maxMag = Math.max(...spectrum);
  const barWidth = width / spectrum.length;
  
  for (let i = 0; i < spectrum.length; i++) {
    const normalized = spectrum[i] / maxMag;
    const barHeight = normalized * height * 0.9;
    
    const hue = (i / spectrum.length) * 120 + 180;
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(
      i * barWidth,
      height - barHeight,
      Math.max(1, barWidth - 1),
      barHeight
    );
  }
}
