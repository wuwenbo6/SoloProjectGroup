export class FFT {
  private size: number;
  private forward: boolean;
  private cos: Float32Array;
  private sin: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.forward = true;
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos(-2 * Math.PI * i / size);
      this.sin[i] = Math.sin(-2 * Math.PI * i / size);
    }
  }

  public transform(real: Float32Array, imag: Float32Array): void {
    const n = this.size;
    
    let j = 0;
    for (let i = 1; i < n - 1; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) {
        j ^= bit;
      }
      j ^= bit;
      
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    
    for (let mmax = 1, istep = 2 * mmax; mmax < n; mmax = istep, istep = 2 * mmax) {
      for (let m = 0; m < mmax; m++) {
        const w = Math.floor(m * (n / mmax / 2));
        const wr = this.cos[w];
        const wi = this.sin[w];
        
        for (let i = m; i < n; i += istep) {
          const j = i + mmax;
          const tr = wr * real[j] - wi * imag[j];
          const ti = wr * imag[j] + wi * real[j];
          real[j] = real[i] - tr;
          imag[j] = imag[i] - ti;
          real[i] += tr;
          imag[i] += ti;
        }
      }
    }
    
    if (!this.forward) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

  public inverse(real: Float32Array, imag: Float32Array): void {
    for (let i = 0; i < this.size; i++) {
      imag[i] = -imag[i];
    }
    this.forward = false;
    this.transform(real, imag);
    this.forward = true;
    for (let i = 0; i < this.size; i++) {
      imag[i] = -imag[i];
    }
  }
}

export function createHann(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
  }
  return window;
}

export function applyWindow(samples: Float32Array, window: Float32Array): Float32Array {
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * window[i];
  }
  return result;
}

export function magnitudeSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
  const n = real.length;
  const magnitude = new Float32Array(n / 2 + 1);
  for (let i = 0; i <= n / 2; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return magnitude;
}

export function stft(samples: Float32Array, fftSize: number, hopSize: number): Float32Array[] {
  const window = createHann(fftSize);
  const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
  const spectra: Float32Array[] = [];
  
  const fft = new FFT(fftSize);
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = samples.slice(start, start + fftSize);
    const windowed = applyWindow(frame, window);
    
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) {
      real[j] = windowed[j];
    }
    
    fft.transform(real, imag);
    spectra.push(magnitudeSpectrum(real, imag));
  }
  
  return spectra;
}
