import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';

export interface RecognitionResult {
  modelId: string | null;
  modelName: string;
  manufacturer: string;
  confidence: number;
  matchedFeatures: string[];
  recommendedConfig: SerialPortConfig | null;
}

export interface SerialPortConfig {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
  handshake?: 'xon' | 'rtscts';
}

export interface TypewriterFingerprint {
  modelId: string;
  modelName: string;
  manufacturer: string;
  identifiers: {
    usbVendorId?: string[];
    usbProductId?: string[];
    serialNumberPatterns?: string[];
    manufacturerStrings?: string[];
  };
  portConfigs: SerialPortConfig[];
  characterPatterns: {
    charWidth: number;
    lineHeight: number;
    hasSerif: boolean;
    typicalCharacters: string[];
  };
  responseSignatures: string[];
  yearRange: [number, number];
}

const TYPEWRITER_FINGERPRINTS: TypewriterFingerprint[] = [
  {
    modelId: 'ibm-selectric-i',
    modelName: 'IBM Selectric I',
    manufacturer: 'IBM',
    identifiers: {
      usbVendorId: ['04B3'],
      manufacturerStrings: ['IBM', 'International Business Machines']
    },
    portConfigs: [
      { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
      { baudRate: 4800, dataBits: 8, stopBits: 1, parity: 'none' }
    ],
    characterPatterns: {
      charWidth: 10,
      lineHeight: 12,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C', '1', '2', '3']
    },
    responseSignatures: ['IBM', 'SELECTRIC', 'READY'],
    yearRange: [1961, 1970]
  },
  {
    modelId: 'ibm-selectric-ii',
    modelName: 'IBM Selectric II',
    manufacturer: 'IBM',
    identifiers: {
      usbVendorId: ['04B3'],
      manufacturerStrings: ['IBM']
    },
    portConfigs: [
      { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
      { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'none' }
    ],
    characterPatterns: {
      charWidth: 10,
      lineHeight: 12,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C', '1', '2', '3']
    },
    responseSignatures: ['IBM', 'SELECTRIC II', 'READY'],
    yearRange: [1971, 1985]
  },
  {
    modelId: 'olympia-sm3',
    modelName: 'Olympia SM3',
    manufacturer: 'Olympia',
    identifiers: {
      manufacturerStrings: ['Olympia', 'Olympia Werke']
    },
    portConfigs: [
      { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'even' }
    ],
    characterPatterns: {
      charWidth: 9,
      lineHeight: 11,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C']
    },
    responseSignatures: ['OLYMPIA', 'SM3'],
    yearRange: [1958, 1970]
  },
  {
    modelId: 'underwood-noiseless',
    modelName: 'Underwood Noiseless',
    manufacturer: 'Underwood',
    identifiers: {
      manufacturerStrings: ['Underwood', 'Underwood Typewriter']
    },
    portConfigs: [
      { baudRate: 4800, dataBits: 7, stopBits: 2, parity: 'odd' },
      { baudRate: 9600, dataBits: 7, stopBits: 2, parity: 'odd' }
    ],
    characterPatterns: {
      charWidth: 8,
      lineHeight: 10,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C']
    },
    responseSignatures: ['UNDERWOOD', 'NOISELESS'],
    yearRange: [1950, 1965]
  },
  {
    modelId: 'brother-gx6750',
    modelName: 'Brother GX6750',
    manufacturer: 'Brother',
    identifiers: {
      usbVendorId: ['04F9'],
      manufacturerStrings: ['Brother', 'Brother Industries']
    },
    portConfigs: [
      { baudRate: 38400, dataBits: 8, stopBits: 1, parity: 'none' }
    ],
    characterPatterns: {
      charWidth: 11,
      lineHeight: 13,
      hasSerif: false,
      typicalCharacters: ['A', 'B', 'C', '1', '2', '3']
    },
    responseSignatures: ['BROTHER', 'GX', 'READY'],
    yearRange: [1995, 2005]
  },
  {
    modelId: 'royal-quiet-deluxe',
    modelName: 'Royal Quiet Deluxe',
    manufacturer: 'Royal',
    identifiers: {
      manufacturerStrings: ['Royal', 'Royal Typewriter']
    },
    portConfigs: [
      { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' }
    ],
    characterPatterns: {
      charWidth: 9,
      lineHeight: 11,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C']
    },
    responseSignatures: ['ROYAL', 'QUIET', 'DELUXE'],
    yearRange: [1948, 1960]
  },
  {
    modelId: 'remington-noiseless',
    modelName: 'Remington Noiseless',
    manufacturer: 'Remington',
    identifiers: {
      manufacturerStrings: ['Remington', 'Remington Rand']
    },
    portConfigs: [
      { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' }
    ],
    characterPatterns: {
      charWidth: 10,
      lineHeight: 12,
      hasSerif: true,
      typicalCharacters: ['A', 'B', 'C']
    },
    responseSignatures: ['REMINGTON', 'NOISELESS'],
    yearRange: [1940, 1955]
  }
];

export class ModelRecognitionModule extends EventEmitter {
  private recognitionCache: Map<string, RecognitionResult> = new Map();
  private probeTimeout: number = 5000;

  constructor() {
    super();
  }

  async detectConnectedDevices(): Promise<any[]> {
    try {
      const ports = await SerialPort.list();
      const devices: any[] = [];

      for (const port of ports) {
        const deviceInfo = {
          path: port.path,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
          vendorId: port.vendorId,
          productId: port.productId,
          pnpId: port.pnpId
        };
        devices.push(deviceInfo);
      }

      this.emit('devices-detected', { count: devices.length, devices });
      return devices;
    } catch (error) {
      console.error('Failed to detect devices:', error);
      return [];
    }
  }

  async recognizeModel(deviceInfo: any): Promise<RecognitionResult> {
    const cacheKey = `${deviceInfo.path}_${deviceInfo.serialNumber || 'unknown'}`;
    
    if (this.recognitionCache.has(cacheKey)) {
      return this.recognitionCache.get(cacheKey)!;
    }

    const matches: Array<{ fingerprint: TypewriterFingerprint; score: number; matchedFeatures: string[] }> = [];

    for (const fingerprint of TYPEWRITER_FINGERPRINTS) {
      const result = this.matchFingerprint(fingerprint, deviceInfo);
      if (result.score > 0) {
        matches.push({ fingerprint, ...result });
      }
    }

    matches.sort((a, b) => b.score - a.score);

    let result: RecognitionResult;

    if (matches.length > 0 && matches[0].score >= 30) {
      const bestMatch = matches[0];
      result = {
        modelId: bestMatch.fingerprint.modelId,
        modelName: bestMatch.fingerprint.modelName,
        manufacturer: bestMatch.fingerprint.manufacturer,
        confidence: Math.min(bestMatch.score, 100),
        matchedFeatures: bestMatch.matchedFeatures,
        recommendedConfig: bestMatch.fingerprint.portConfigs[0]
      };
    } else {
      result = {
        modelId: null,
        modelName: '未知型号',
        manufacturer: '未知',
        confidence: 0,
        matchedFeatures: [],
        recommendedConfig: {
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        }
      };
    }

    this.recognitionCache.set(cacheKey, result);
    this.emit('model-recognized', { device: deviceInfo.path, result });

    return result;
  }

  private matchFingerprint(
    fingerprint: TypewriterFingerprint,
    deviceInfo: any
  ): { score: number; matchedFeatures: string[] } {
    let score = 0;
    const matchedFeatures: string[] = [];

    if (deviceInfo.vendorId && fingerprint.identifiers.usbVendorId) {
      const vendorMatch = fingerprint.identifiers.usbVendorId.some(
        vid => deviceInfo.vendorId.toLowerCase() === vid.toLowerCase()
      );
      if (vendorMatch) {
        score += 40;
        matchedFeatures.push('USB Vendor ID 匹配');
      }
    }

    if (deviceInfo.manufacturer && fingerprint.identifiers.manufacturerStrings) {
      const manuMatch = fingerprint.identifiers.manufacturerStrings.some(
        manu => deviceInfo.manufacturer.toLowerCase().includes(manu.toLowerCase())
      );
      if (manuMatch) {
        score += 30;
        matchedFeatures.push('制造商名称匹配');
      }
    }

    if (deviceInfo.serialNumber && fingerprint.identifiers.serialNumberPatterns) {
      const serialMatch = fingerprint.identifiers.serialNumberPatterns.some(
        pattern => new RegExp(pattern, 'i').test(deviceInfo.serialNumber)
      );
      if (serialMatch) {
        score += 25;
        matchedFeatures.push('序列号格式匹配');
      }
    }

    if (deviceInfo.productId && fingerprint.identifiers.usbProductId) {
      const productMatch = fingerprint.identifiers.usbProductId.some(
        pid => deviceInfo.productId.toLowerCase() === pid.toLowerCase()
      );
      if (productMatch) {
        score += 20;
        matchedFeatures.push('USB Product ID 匹配');
      }
    }

    return { score, matchedFeatures };
  }

  async probeDevice(portPath: string, config: SerialPortConfig): Promise<{
    success: boolean;
    response?: string;
    config: SerialPortConfig;
  }> {
    return new Promise((resolve) => {
      const port = new SerialPort({
        path: portPath,
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity,
        autoOpen: false
      });

      const timeout = setTimeout(() => {
        port.close(() => {});
        resolve({ success: false, config });
      }, this.probeTimeout);

      port.open((error) => {
        if (error) {
          clearTimeout(timeout);
          resolve({ success: false, config });
          return;
        }

        port.once('data', (data) => {
          clearTimeout(timeout);
          const response = data.toString('ascii', 0, Math.min(data.length, 100));
          port.close(() => {});
          resolve({ success: true, response, config });
        });

        port.write('\rID?\n', (writeError) => {
          if (writeError) {
            clearTimeout(timeout);
            port.close(() => {});
            resolve({ success: false, config });
          }
        });
      });
    });
  }

  async autoConfigure(portPath: string): Promise<{
    success: boolean;
    config?: SerialPortConfig;
    model?: string;
  }> {
    this.emit('auto-config-start', { port: portPath });

    const devices = await this.detectConnectedDevices();
    const device = devices.find(d => d.path === portPath);

    if (!device) {
      return { success: false };
    }

    const recognition = await this.recognizeModel(device);
    
    if (!recognition.modelId) {
      return { success: false };
    }

    const fingerprint = TYPEWRITER_FINGERPRINTS.find(f => f.modelId === recognition.modelId);
    if (!fingerprint) {
      return { success: false };
    }

    for (const config of fingerprint.portConfigs) {
      const probeResult = await this.probeDevice(portPath, config);
      if (probeResult.success) {
        this.emit('auto-config-complete', {
          port: portPath,
          model: fingerprint.modelName,
          config
        });
        return {
          success: true,
          config,
          model: fingerprint.modelName
        };
      }
    }

    return { success: true, config: fingerprint.portConfigs[0], model: fingerprint.modelName };
  }

  getAllModels(): TypewriterFingerprint[] {
    return TYPEWRITER_FINGERPRINTS;
  }

  getModel(modelId: string): TypewriterFingerprint | undefined {
    return TYPEWRITER_FINGERPRINTS.find(f => f.modelId === modelId);
  }

  searchModels(query: string): TypewriterFingerprint[] {
    const lowerQuery = query.toLowerCase();
    return TYPEWRITER_FINGERPRINTS.filter(f =>
      f.modelName.toLowerCase().includes(lowerQuery) ||
      f.manufacturer.toLowerCase().includes(lowerQuery) ||
      f.modelId.toLowerCase().includes(lowerQuery)
    );
  }

  getManufacturers(): string[] {
    return [...new Set(TYPEWRITER_FINGERPRINTS.map(f => f.manufacturer))];
  }

  clearCache(): void {
    this.recognitionCache.clear();
    this.emit('cache-cleared');
  }

  setProbeTimeout(timeout: number): void {
    this.probeTimeout = timeout;
  }

  async identifyFromCharacteristics(
    charWidth: number,
    hasSerif: boolean,
    lineHeight?: number
  ): Promise<RecognitionResult[]> {
    const results: Array<{
      fingerprint: TypewriterFingerprint;
      score: number;
      matchedFeatures: string[];
    }> = [];

    for (const fingerprint of TYPEWRITER_FINGERPRINTS) {
      let score = 0;
      const matchedFeatures: string[] = [];

      const widthDiff = Math.abs(fingerprint.characterPatterns.charWidth - charWidth);
      if (widthDiff <= 1) {
        score += 40;
        matchedFeatures.push('字符宽度匹配');
      } else if (widthDiff <= 2) {
        score += 20;
        matchedFeatures.push('字符宽度相似');
      }

      if (fingerprint.characterPatterns.hasSerif === hasSerif) {
        score += 30;
        matchedFeatures.push('衬线特征匹配');
      }

      if (lineHeight !== undefined) {
        const heightDiff = Math.abs(fingerprint.characterPatterns.lineHeight - lineHeight);
        if (heightDiff <= 1) {
          score += 30;
          matchedFeatures.push('行高匹配');
        }
      }

      if (score > 0) {
        results.push({ fingerprint, score, matchedFeatures });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.map(r => ({
      modelId: r.fingerprint.modelId,
      modelName: r.fingerprint.modelName,
      manufacturer: r.fingerprint.manufacturer,
      confidence: Math.min(r.score, 100),
      matchedFeatures: r.matchedFeatures,
      recommendedConfig: r.fingerprint.portConfigs[0]
    }));
  }
}
