import crypto from 'crypto';

export interface TraceCodeResult {
  code: string;
  timestamp: number;
  randomPart: string;
}

export class TraceCodeGenerator {
  private static instance: TraceCodeGenerator;
  private lastTimestamp: number = 0;
  private sequence: number = 0;
  private readonly maxSequence: number = 9999;

  private constructor() {}

  public static getInstance(): TraceCodeGenerator {
    if (!TraceCodeGenerator.instance) {
      TraceCodeGenerator.instance = new TraceCodeGenerator();
    }
    return TraceCodeGenerator.instance;
  }

  private waitForNextTimestamp(currentTimestamp: number): number {
    let timestamp = this.getCurrentTimestamp();
    while (timestamp <= currentTimestamp) {
      timestamp = this.getCurrentTimestamp();
    }
    return timestamp;
  }

  private getCurrentTimestamp(): number {
    return Date.now();
  }

  public generate(prefix: string = 'TC'): TraceCodeResult {
    let timestamp = this.getCurrentTimestamp();

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) % (this.maxSequence + 1);
      if (this.sequence === 0) {
        timestamp = this.waitForNextTimestamp(timestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const sequenceStr = this.sequence.toString().padStart(4, '0');
    const timeStr = timestamp.toString().slice(-8);
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    const checksum = this.generateChecksum(`${prefix}${timeStr}${sequenceStr}${randomPart}`);

    const code = `${prefix}-${timeStr}-${sequenceStr}-${randomPart}-${checksum}`;

    return {
      code,
      timestamp,
      randomPart
    };
  }

  private generateChecksum(input: string): string {
    const hash = crypto
      .createHash('md5')
      .update(input)
      .digest('hex')
      .toUpperCase();
    return hash.slice(0, 4);
  }

  public validate(code: string): boolean {
    const parts = code.split('-');
    if (parts.length !== 5) return false;

    const [prefix, timeStr, sequenceStr, randomPart, checksum] = parts;
    const calculatedChecksum = this.generateChecksum(`${prefix}${timeStr}${sequenceStr}${randomPart}`);

    return calculatedChecksum === checksum;
  }

  public async generateWithRetry(
    prefix: string,
    checkExists: (code: string) => Promise<boolean>,
    maxRetries: number = 5
  ): Promise<string> {
    let retries = 0;

    while (retries < maxRetries) {
      const { code } = this.generate(prefix);
      const exists = await checkExists(code);

      if (!exists) {
        return code;
      }

      retries++;
      await new Promise(resolve => setTimeout(resolve, retries * 10));
    }

    throw new Error(`Failed to generate unique trace code after ${maxRetries} attempts`);
  }
}

export const traceCodeGenerator = TraceCodeGenerator.getInstance();

export const generateMaterialTraceCode = async (
  checkExists: (code: string) => Promise<boolean>
): Promise<string> => {
  return traceCodeGenerator.generateWithRetry('MAT', checkExists);
};

export const generateBatchTraceCode = async (
  checkExists: (code: string) => Promise<boolean>
): Promise<string> => {
  return traceCodeGenerator.generateWithRetry('BAT', checkExists);
};

export const generateProductionTraceCode = async (
  checkExists: (code: string) => Promise<boolean>
): Promise<string> => {
  return traceCodeGenerator.generateWithRetry('PRD', checkExists);
};

export const generateQualityTraceCode = async (
  checkExists: (code: string) => Promise<boolean>
): Promise<string> => {
  return traceCodeGenerator.generateWithRetry('QLT', checkExists);
};
