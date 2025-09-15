import winston from 'winston';
import { HealthCheckResult, HealthSummary } from '../types';

export class Logger {
  private logger: winston.Logger;

  constructor(level: string = 'info', format: string = 'json') {
    this.logger = winston.createLogger({
      level,
      format: format === 'json' ? winston.format.json() : winston.format.simple(),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize({ all: true }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          )
        })
      ]
    });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    this.logger.error(message, error);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  logHealthCheckResult(result: HealthCheckResult): void {
    const logLevel = (result.status === 'unhealthy' || result.status === 'unknown') ? 'warn' : 'info';
    this.logger.log(logLevel, 'Health check executed', {
      checkId: result.id,
      checkName: result.name,
      checkType: result.type,
      status: result.status,
      duration: result.duration,
      timestamp: result.timestamp,
      ...(result.error && { error: result.error }),
      ...(result.message && { message: result.message }),
    });
  }

  logHealthSummary(summary: HealthSummary): void {
    const logLevel = (summary.status === 'unhealthy' || summary.status === 'unknown') ? 'warn' : 'info';
    this.logger.log(logLevel, 'Health summary', {
      overallStatus: summary.status,
      totalChecks: summary.totalChecks,
      healthyChecks: summary.healthyChecks,
      unhealthyChecks: summary.unhealthyChecks,
      degradedChecks: summary.degradedChecks,
      timestamp: summary.timestamp,
    });
  }
}