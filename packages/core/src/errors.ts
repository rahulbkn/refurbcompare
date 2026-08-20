import type { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'GONE'
  | 'UNPROCESSABLE'
  | 'INTERNAL_ERROR'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INTEGRATION_DISABLED'
  | 'CONFIG_ERROR'
  | 'UNAVAILABLE';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly retryable: boolean;

  constructor(opts: {
    code: ErrorCode;
    status: number;
    message: string;
    details?: unknown;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.retryable = opts.retryable ?? false;
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError({ code: 'NOT_FOUND', status: 404, message });
  }

  static validation(err: ZodError): AppError {
    return new AppError({ code: 'VALIDATION_ERROR', status: 400, message: 'Invalid request', details: err.flatten() });
  }

  static validationMsg(details: unknown): AppError {
    return new AppError({ code: 'VALIDATION_ERROR', status: 400, message: 'Invalid request', details });
  }

  static conflict(message: string): AppError {
    return new AppError({ code: 'CONFLICT', status: 409, message });
  }

  static gone(message = 'Resource is no longer available'): AppError {
    return new AppError({ code: 'GONE', status: 410, message });
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError({ code: 'FORBIDDEN', status: 403, message });
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError({ code: 'UNAUTHORIZED', status: 401, message });
  }

  static providerNotConfigured(message: string): AppError {
    return new AppError({ code: 'PROVIDER_NOT_CONFIGURED', status: 424, message });
  }

  static unavailable(message = 'Service temporarily unavailable', retryable = true): AppError {
    return new AppError({ code: 'UNAVAILABLE', status: 503, message, retryable });
  }

  static config(message: string): AppError {
    return new AppError({ code: 'CONFIG_ERROR', status: 500, message });
  }
}