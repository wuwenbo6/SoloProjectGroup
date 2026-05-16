declare namespace LogSDK {
  type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

  interface UserSampleRule {
    userIds?: string[];
    userPrefix?: string;
    sampleRate: number;
  }

  interface Pako {
    gzip(data: string | Uint8Array): Uint8Array;
  }

  interface LogOptions {
    appId: string;
    userId?: string;
    level?: LogLevel;
    endpoint?: string;
    batchSize?: number;
    flushInterval?: number;
    maxRetries?: number;
    timeout?: number;
    captureGlobalErrors?: boolean;
    captureResourceErrors?: boolean;
    sampleRate?: number;
    userSampleRules?: UserSampleRule[];
    enableCompression?: boolean;
    pako?: Pako;
  }

  interface LogData {
    app_id: string;
    user_id: string;
    level: LogLevel;
    message: string;
    timestamp: number;
    extra: Record<string, any>;
    url: string;
    user_agent: string;
  }

  interface LogSDKClass {
    new (options?: LogOptions): LogSDKInstance;
    init(options: LogOptions): LogSDKInstance;
    getInstance(): LogSDKInstance | null;
    Levels: Record<LogLevel, number>;
  }

  interface LogSDKInstance {
    init(options: LogOptions): this;
    debug(message: string | any, extra?: Record<string, any>): void;
    info(message: string | any, extra?: Record<string, any>): void;
    warn(message: string | any, extra?: Record<string, any>): void;
    error(message: string | any, extra?: Record<string, any>): void;
    fatal(message: string | any, extra?: Record<string, any>): void;
    log(level: LogLevel, message: string | any, extra?: Record<string, any>): void;
    setUserId(userId: string): void;
    setLevel(level: LogLevel): void;
    setSampleRate(sampleRate: number): void;
    setUserSampleRules(rules: UserSampleRule[]): void;
    enableCompression(pako?: Pako): void;
    flush(): void;
    destroy(): void;
  }
}

declare const LogSDK: LogSDK.LogSDKClass;

export = LogSDK;
export as namespace LogSDK;
