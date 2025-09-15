import { describe, it, expect, vi, beforeEach } from 'vitest';
import winston from 'winston';
import { Logger } from '../services/logger';
import { HealthStatus, HealthCheckType } from '../types';

// Mock winston
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    })),
    format: {
      json: vi.fn(() => 'json-format'),
      simple: vi.fn(() => 'simple-format'),
      combine: vi.fn(() => 'combined-format'),
      timestamp: vi.fn(() => 'timestamp-format'),
      colorize: vi.fn(() => 'colorize-format'),
      printf: vi.fn(() => 'printf-format'),
    },
    transports: {
      Console: vi.fn().mockImplementation(() => ({})),
    },
  },
}));

describe('Logger', () => {
  let logger: Logger;
  let mockWinstonLogger: any;

  beforeEach(() => {
    mockWinstonLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    vi.mocked(winston.createLogger).mockReturnValue(mockWinstonLogger);
    logger = new Logger();
  });

  describe('constructor', () => {
    it('should create logger with default settings', () => {
      new Logger();

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: 'json-format',
        transports: expect.any(Array),
      });
    });

    it('should create logger with custom level and format', () => {
      new Logger('debug', 'simple');

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        format: 'simple-format',
        transports: expect.any(Array),
      });
    });

    it('should use json format when specified', () => {
      new Logger('info', 'json');

      expect(winston.format.json).toHaveBeenCalled();
    });

    it('should use simple format when not json', () => {
      new Logger('info', 'simple');

      expect(winston.format.simple).toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info message without metadata', () => {
      logger.info('Test info message');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test info message', undefined);
    });

    it('should log info message with metadata', () => {
      const meta = { key: 'value', number: 123 };
      logger.info('Test info message', meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test info message', meta);
    });
  });

  describe('error', () => {
    it('should log error message without error object', () => {
      logger.error('Test error message');

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Test error message', undefined);
    });

    it('should log error message with Error object', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Test error message', error);
    });

    it('should log error message with metadata object', () => {
      const meta = { code: 500, details: 'Server error' };
      logger.error('Test error message', meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Test error message', meta);
    });
  });

  describe('warn', () => {
    it('should log warning message without metadata', () => {
      logger.warn('Test warning message');

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Test warning message', undefined);
    });

    it('should log warning message with metadata', () => {
      const meta = { reason: 'deprecated', alternative: 'new method' };
      logger.warn('Test warning message', meta);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Test warning message', meta);
    });
  });

  describe('debug', () => {
    it('should log debug message without metadata', () => {
      logger.debug('Test debug message');

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Test debug message', undefined);
    });

    it('should log debug message with metadata', () => {
      const meta = { step: 1, data: 'processing' };
      logger.debug('Test debug message', meta);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Test debug message', meta);
    });
  });

  describe('logHealthCheckResult', () => {
    it('should log healthy check result at info level', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 150,
        message: 'All good',
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        duration: 150,
        timestamp: result.timestamp,
        message: 'All good',
      });
    });

    it('should log degraded check result at info level', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.DEGRADED,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 4500,
        message: 'Slow response',
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.HTTP,
        status: HealthStatus.DEGRADED,
        duration: 4500,
        timestamp: result.timestamp,
        message: 'Slow response',
      });
    });

    it('should log unhealthy check result at warn level', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 5000,
        error: 'Connection failed',
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.HTTP,
        status: HealthStatus.UNHEALTHY,
        duration: 5000,
        timestamp: result.timestamp,
        error: 'Connection failed',
      });
    });

    it('should log unknown check result at warn level', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.UNKNOWN,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 0,
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.HTTP,
        status: HealthStatus.UNKNOWN,
        duration: 0,
        timestamp: result.timestamp,
      });
    });

    it('should include error in log when present', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.DATABASE,
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 8000,
        error: 'Database connection timeout',
        message: 'Connection failed',
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.DATABASE,
        status: HealthStatus.UNHEALTHY,
        duration: 8000,
        timestamp: result.timestamp,
        error: 'Database connection timeout',
        message: 'Connection failed',
      });
    });

    it('should exclude error from log when not present', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.SYSTEM,
        status: HealthStatus.HEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 200,
        message: 'System resources OK',
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.SYSTEM,
        status: HealthStatus.HEALTHY,
        duration: 200,
        timestamp: result.timestamp,
        message: 'System resources OK',
      });
    });

    it('should exclude message from log when not present', () => {
      const result = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        duration: 150,
      };

      logger.logHealthCheckResult(result);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health check executed', {
        checkId: 'test-check',
        checkName: 'Test Check',
        checkType: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        duration: 150,
        timestamp: result.timestamp,
      });
    });
  });

  describe('logHealthSummary', () => {
    it('should log healthy summary at info level', () => {
      const summary = {
        status: HealthStatus.HEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        totalChecks: 3,
        healthyChecks: 3,
        unhealthyChecks: 0,
        degradedChecks: 0,
        unknownChecks: 0,
        checks: [],
      };

      logger.logHealthSummary(summary);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health summary', {
        overallStatus: HealthStatus.HEALTHY,
        totalChecks: 3,
        healthyChecks: 3,
        unhealthyChecks: 0,
        degradedChecks: 0,
        timestamp: summary.timestamp,
      });
    });

    it('should log degraded summary at info level', () => {
      const summary = {
        status: HealthStatus.DEGRADED,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        totalChecks: 3,
        healthyChecks: 2,
        unhealthyChecks: 0,
        degradedChecks: 1,
        unknownChecks: 0,
        checks: [],
      };

      logger.logHealthSummary(summary);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Health summary', {
        overallStatus: HealthStatus.DEGRADED,
        totalChecks: 3,
        healthyChecks: 2,
        unhealthyChecks: 0,
        degradedChecks: 1,
        timestamp: summary.timestamp,
      });
    });

    it('should log unhealthy summary at warn level', () => {
      const summary = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        totalChecks: 3,
        healthyChecks: 1,
        unhealthyChecks: 2,
        degradedChecks: 0,
        unknownChecks: 0,
        checks: [],
      };

      logger.logHealthSummary(summary);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Health summary', {
        overallStatus: HealthStatus.UNHEALTHY,
        totalChecks: 3,
        healthyChecks: 1,
        unhealthyChecks: 2,
        degradedChecks: 0,
        timestamp: summary.timestamp,
      });
    });

    it('should log unknown summary at warn level', () => {
      const summary = {
        status: HealthStatus.UNKNOWN,
        timestamp: new Date('2023-01-01T00:00:00Z'),
        totalChecks: 3,
        healthyChecks: 0,
        unhealthyChecks: 0,
        degradedChecks: 0,
        unknownChecks: 3,
        checks: [],
      };

      logger.logHealthSummary(summary);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Health summary', {
        overallStatus: HealthStatus.UNKNOWN,
        totalChecks: 3,
        healthyChecks: 0,
        unhealthyChecks: 0,
        degradedChecks: 0,
        timestamp: summary.timestamp,
      });
    });
  });

  describe('winston configuration', () => {
    it('should configure console transport with proper formatting', () => {
      new Logger();

      expect(winston.transports.Console).toHaveBeenCalledWith({
        format: 'combined-format',
      });

      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.colorize).toHaveBeenCalledWith({ all: true });
      expect(winston.format.printf).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});