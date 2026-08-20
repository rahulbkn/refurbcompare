import { pino, type Logger as PinoLogger } from 'pino';

export interface AppLogger {
  trace(obj: object | string, msg?: string): void;
  debug(obj: object | string, msg?: string): void;
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
  fatal(obj: object | string, msg?: string): void;
  child(bindings: object): AppLogger;
}

class PinoAppLogger implements AppLogger {
  constructor(private readonly logger: PinoLogger) {}

  private adapt(fn: (obj: object, msg?: string) => void, obj: object | string, msg?: string): void {
    if (typeof obj === 'string') {
      fn({ msg: obj }, msg);
    } else {
      fn(obj, msg);
    }
  }

  trace(obj: object | string, msg?: string): void {
    this.adapt(this.logger.trace.bind(this.logger), obj as object, msg);
  }
  debug(obj: object | string, msg?: string): void {
    this.adapt(this.logger.debug.bind(this.logger), obj as object, msg);
  }
  info(obj: object | string, msg?: string): void {
    this.adapt(this.logger.info.bind(this.logger), obj as object, msg);
  }
  warn(obj: object | string, msg?: string): void {
    this.adapt(this.logger.warn.bind(this.logger), obj as object, msg);
  }
  error(obj: object | string, msg?: string): void {
    this.adapt(this.logger.error.bind(this.logger), obj as object, msg);
  }
  fatal(obj: object | string, msg?: string): void {
    this.adapt(this.logger.fatal.bind(this.logger), obj as object, msg);
  }
  child(bindings: object): AppLogger {
    return new PinoAppLogger(this.logger.child(bindings as Record<string, unknown>));
  }
}

export function createLogger(level = 'info'): AppLogger {
  const p = pino({
    level,
    base: { service: 'refurbcompare' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return new PinoAppLogger(p);
}