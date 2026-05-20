const { parentPort } = require('worker_threads');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let isRunning = false;
let rtlSdrProcess = null;
let sampleRate = 240000;
let centerFreq = 98000000;
let gain = 40;
let bandwidth = 12500;
let demodMode = 'fm';

let iqBuffer = [];
const BUFFER_SIZE = 2048;

let phase = 0;
let iirAlpha = 0.1;
let prevQuadrature = 0;
let prevI = 0;
let prevQ = 0;

let lastFFTSend = 0;
const FFT_SEND_INTERVAL = 32;
let fftResultCache = null;

const FFT_SIZE = 512;
const cosTable = new Array(FFT_SIZE);
const sinTable = new Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  cosTable[i] = Math.cos(-2 * Math.PI * i / FFT_SIZE);
  sinTable[i] = Math.sin(-2 * Math.PI * i / FFT_SIZE);
}

let rttyMarkFreq = 2125;
let rttySpaceFreq = 2295;
let rttyBitLength = 0;
let rttyShift = 170;
let rttyLastBit = 0;
let rttyBitBuffer = [];
let rttyByteBuffer = [];
let rttyBitCount = 0;
let rttyCurrentByte = 0;

let sstvPixelBuffer = [];
let sstvLineBuffer = [];
let sstvSyncDetected = false;
let sstvLastSync = 0;

let afcEnabled = false;
let afcFrequency = 0;
let afcAlpha = 0.01;
let afcPilotFreq = 1000;

let csvLoggingEnabled = false;

function lowPassFilter(samples, cutoffFreq, sampleRate) {
  const rc = 1.0 / (2 * Math.PI * cutoffFreq);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  
  let filtered = new Array(samples.length);
  let prev = 0;
  
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    filtered[i] = prev;
  }
  
  return filtered;
}

function fft(data) {
  const n = data.length;
  if (n <= 1) return data;

  const even = [];
  const odd = [];
  for (let i = 0; i < n; i += 2) {
    even.push(data[i]);
    odd.push(data[i + 1] || 0);
  }

  const fftEven = fft(even);
  const fftOdd = fft(odd);

  const result = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const t = Math.exp(-2 * Math.PI * k / n) * fftOdd[k];
    result[k] = fftEven[k] + t;
    result[k + n / 2] = fftEven[k] - t;
  }

  return result;
}

function computeFFTFast(iqData) {
  const magnitudes = new Array(512).fill(-100);
  
  for (let k = 0; k < 512; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < 256 && n * 2 < iqData.length; n++) {
      const i = (iqData[n * 2] - 127.5) / 127.5;
      const q = (iqData[n * 2 + 1] - 127.5) / 127.5;
      const idx = (k * n) % 512;
      const cos = cosTable[idx];
      const sin = sinTable[idx];
      re += i * cos - q * sin;
      im += i * sin + q * cos;
    }
    const mag = Math.sqrt(re * re + im * im) / 128;
    magnitudes[k] = 20 * Math.log10(mag + 1e-10);
  }
  
  return magnitudes;
}

function measureFrequency(iqData, targetFreq) {
  let corr = 0;
  for (let i = 0; i < Math.min(1024, iqData.length); i += 2) {
    const iVal = (iqData[i] - 127.5) / 127.5;
    const qVal = (iqData[i + 1] - 127.5) / 127.5;
    const t = i / 2 / sampleRate;
    const loRe = Math.cos(2 * Math.PI * targetFreq * t);
    loIm = Math.sin(2 * Math.PI * targetFreq * t);
    corr += (iVal * loRe - qVal * loIm);
  }
  return corr;
}

function demodulateRTTY(iqData) {
  const audioSamples = [];
  const decimation = Math.floor(sampleRate / 48000);
  
  let markSum = 0;
  let spaceSum = 0;
  
  for (let i = 0; i < iqData.length; i += 2) {
    const iVal = (iqData[i] - 127.5) / 127.5;
    const qVal = (iqData[i + 1] - 127.5) / 127.5;
    
    const t = (i / 2) / sampleRate;
    const markPhase = 2 * Math.PI * (rttyMarkFreq + afcFrequency) * t;
    const spacePhase = 2 * Math.PI * (rttySpaceFreq + afcFrequency) * t;
    
    const markCorr = iVal * Math.cos(markPhase) + qVal * Math.sin(markPhase);
    const spaceCorr = iVal * Math.cos(spacePhase) + qVal * Math.sin(spacePhase);
    
    markSum += markCorr * markCorr;
    spaceSum += spaceCorr * spaceCorr;
    
    if ((i / 2) % 100 === 0) {
      const bit = markSum > spaceSum ? 1 : 0;
      
      if (bit !== rttyLastBit) {
        rttyLastBit = bit;
        rttyBitLength = 0;
      } else {
        rttyBitLength++;
      }
      
      const samplesPerBit = Math.floor(sampleRate / 45.45 / 100);
      
      if (rttyBitLength >= samplesPerBit) {
        rttyBitBuffer.push(bit);
        rttyBitLength = 0;
        
        if (rttyBitBuffer.length >= 7) {
          rttyCurrentByte = 0;
          for (let b = 0; b < 7; b++) {
            rttyCurrentByte |= (rttyBitBuffer[b] << b);
          }
          const charCode = rttyCurrentByte & 0x7F;
          if (charCode >= 32 && charCode <= 126) {
            parentPort.postMessage({
              type: 'rtty-char',
              char: String.fromCharCode(charCode)
            });
          }
          rttyBitBuffer = [];
        }
      }
      
      markSum = 0;
      spaceSum = 0;
    }
    
    if ((i / 2) % decimation === 0) {
      audioSamples.push(Math.sqrt(iVal * iVal + qVal * qVal) - 0.5);
    }
  }
  
  return lowPassFilter(audioSamples, 3000, 48000);
}

function demodulateSSTV(iqData) {
  const audioSamples = [];
  const decimation = Math.floor(sampleRate / 48000);
  
  let instantPhase = 0;
  for (let i = 0; i < iqData.length; i += 2) {
    const iVal = (iqData[i] - 127.5) / 127.5;
    const qVal = (iqData[i + 1] - 127.5) / 127.5;
    
    const demod = Math.atan2(qVal * prevI - iVal * prevQ, iVal * prevI + qVal * prevQ);
    prevI = iVal;
    prevQ = qVal;
    
    instantPhase += demod;
    
    const sampleNum = i / 2;
    const freq = (instantPhase / (sampleNum / sampleRate)) / (2 * Math.PI);
    
    if (freq >= 1100 && freq <= 1300 && !sstvSyncDetected) {
      sstvSyncDetected = true;
      sstvLastSync = sampleNum;
      parentPort.postMessage({
        type: 'sstv-sync',
        message: 'SSTV sync detected'
      });
    }
    
    if (sstvSyncDetected) {
      const pixelValue = Math.max(0, Math.min(255, Math.floor((freq - 1500) / 8)));
      sstvPixelBuffer.push(pixelValue);
      
      if (sstvPixelBuffer.length >= 320) {
        parentPort.postMessage({
          type: 'sstv-line',
          data: sstvPixelBuffer.slice(0, 320)
        });
        sstvPixelBuffer = sstvPixelBuffer.slice(320);
      }
    }
    
    if ((i / 2) % decimation === 0) {
      audioSamples.push(demod * 2);
    }
  }
  
  return lowPassFilter(audioSamples, 3000, 48000);
}

function runAFC(iqData) {
  if (!afcEnabled) return;
  
  let maxCorr = -Infinity;
  let bestFreq = 0;
  
  for (let offset = -500; offset <= 500; offset += 50) {
    const testFreq = afcPilotFreq + offset;
    const corr = measureFrequency(iqData, testFreq);
    if (Math.abs(corr) > maxCorr) {
      maxCorr = Math.abs(corr);
      bestFreq = offset;
    }
  }
  
  afcFrequency = afcFrequency * (1 - afcAlpha) + bestFreq * afcAlpha;
  
  parentPort.postMessage({
    type: 'afc-update',
    frequency: afcFrequency
  });
}

function demodulateFM(iqData) {
  const audioSamples = [];
  const decimation = Math.floor(sampleRate / 48000);
  
  for (let i = 0; i < iqData.length; i += 2) {
    const i = (iqData[i] - 127.5) / 127.5;
    const q = (iqData[i + 1] - 127.5) / 127.5;
    
    const demod = Math.atan2(q * prevI - i * prevQ, i * prevI + q * prevQ);
    prevI = i;
    prevQ = q;
    
    if ((i / 2) % decimation === 0) {
      audioSamples.push(demod * 5);
    }
  }
  
  return lowPassFilter(audioSamples, bandwidth, 48000);
}

function demodulateAM(iqData) {
  const audioSamples = [];
  const decimation = Math.floor(sampleRate / 48000);
  
  for (let i = 0; i < iqData.length; i += 2) {
    const i = (iqData[i] - 127.5) / 127.5;
    const q = (iqData[i + 1] - 127.5) / 127.5;
    
    const magnitude = Math.sqrt(i * i + q * q);
    
    if ((i / 2) % decimation === 0) {
      audioSamples.push((magnitude - 0.5) * 2);
    }
  }
  
  return lowPassFilter(audioSamples, bandwidth, 48000);
}

function processIQData(iqData) {
  iqBuffer = iqBuffer.concat(Array.from(iqData));
  
  while (iqBuffer.length >= BUFFER_SIZE) {
    const chunk = iqBuffer.splice(0, BUFFER_SIZE);
    
    runAFC(chunk);
    
    let audioData;
    switch (demodMode) {
      case 'fm':
        audioData = demodulateFM(chunk);
        break;
      case 'am':
        audioData = demodulateAM(chunk);
        break;
      case 'rtty':
        audioData = demodulateRTTY(chunk);
        break;
      case 'sstv':
        audioData = demodulateSSTV(chunk);
        break;
      default:
        audioData = demodulateFM(chunk);
    }
    
    const now = Date.now();
    if (now - lastFFTSend >= FFT_SEND_INTERVAL) {
      const fftData = computeFFTFast(chunk);
      fftResultCache = fftData;
      lastFFTSend = now;
      
      parentPort.postMessage({
        type: 'fft-data',
        data: fftData,
        timestamp: now
      });
    }
    
    parentPort.postMessage({
      type: 'audio-data',
      data: new Float32Array(audioData).buffer
    });
  }
}

function simulateIQData() {
  const buffer = Buffer.alloc(BUFFER_SIZE);
  const freq = 1000;
  const sampleRateLocal = 240000;
  
  for (let i = 0; i < BUFFER_SIZE; i += 2) {
    const t = (i / 2) / sampleRateLocal;
    const angle = 2 * Math.PI * freq * t + phase;
    
    const i = Math.cos(angle) * 127;
    const q = Math.sin(angle) * 127;
    
    buffer[i] = Math.floor(i) + 128;
    buffer[i + 1] = Math.floor(q) + 128;
  }
  
  phase += 2 * Math.PI * freq * (BUFFER_SIZE / 2) / sampleRateLocal;
  phase = phase % (2 * Math.PI);
  
  return buffer;
}

function startRTLSDR() {
  try {
    rtlSdrProcess = spawn('rtl_sdr', [
      '-f', centerFreq.toString(),
      '-s', sampleRate.toString(),
      '-g', gain.toString(),
      '-'
    ]);

    rtlSdrProcess.stdout.on('data', (data) => {
      processIQData(data);
    });

    rtlSdrProcess.stderr.on('data', (data) => {
      console.log('rtl_sdr:', data.toString());
    });

    rtlSdrProcess.on('close', (code) => {
      console.log(`rtl_sdr process exited with code ${code}`);
      if (isRunning) {
        parentPort.postMessage({
          type: 'error',
          message: 'RTL-SDR device disconnected'
        });
      }
    });

    parentPort.postMessage({ type: 'ready' });
  } catch (error) {
    console.log('Using simulated data:', error.message);
    parentPort.postMessage({ 
      type: 'error', 
      message: 'RTL-SDR not found, using simulated data' 
    });
    
    startSimulation();
  }
}

function startSimulation() {
  isRunning = true;
  parentPort.postMessage({ type: 'ready' });
  
  const interval = setInterval(() => {
    if (!isRunning) {
      clearInterval(interval);
      return;
    }
    
    const simulatedData = simulateIQData();
    processIQData(simulatedData);
  }, 10);
}

function stopRTLSDR() {
  isRunning = false;
  if (rtlSdrProcess) {
    rtlSdrProcess.kill();
    rtlSdrProcess = null;
  }
}

parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'start':
      if (msg.config) {
        centerFreq = msg.config.frequency || 98000000;
        sampleRate = msg.config.sampleRate || 240000;
        gain = msg.config.gain || 40;
        bandwidth = msg.config.bandwidth || 12500;
        demodMode = msg.config.mode || 'fm';
      }
      startRTLSDR();
      break;
      
    case 'stop':
      stopRTLSDR();
      break;
      
    case 'update-config':
      if (msg.config) {
        if (msg.config.frequency !== undefined) centerFreq = msg.config.frequency;
        if (msg.config.gain !== undefined) gain = msg.config.gain;
        if (msg.config.bandwidth !== undefined) bandwidth = msg.config.bandwidth;
        if (msg.config.mode !== undefined) demodMode = msg.config.mode;
        if (msg.config.afcEnabled !== undefined) afcEnabled = msg.config.afcEnabled;
        if (msg.config.afcPilot !== undefined) afcPilotFreq = msg.config.afcPilot;
        if (msg.config.csvLogging !== undefined) csvLoggingEnabled = msg.config.csvLogging;
        if (msg.config.rttyMark !== undefined) rttyMarkFreq = msg.config.rttyMark;
        if (msg.config.rttyShift !== undefined) {
          rttyShift = msg.config.rttyShift;
          rttySpaceFreq = rttyMarkFreq + rttyShift;
        }
      }
      break;
      
    case 'reset-sstv':
      sstvSyncDetected = false;
      sstvPixelBuffer = [];
      break;
      
    case 'reset-rtty':
      rttyBitBuffer = [];
      rttyByteBuffer = [];
      rttyBitCount = 0;
      rttyCurrentByte = 0;
      break;
  }
});
