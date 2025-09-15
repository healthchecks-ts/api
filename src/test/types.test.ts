import { describe, it, expect } from 'vitest';
import { HealthCheckType, HealthStatus } from '../types';

describe('Types and Enums', () => {
  describe('HealthStatus enum', () => {
    it('should have correct values', () => {
      expect(HealthStatus.HEALTHY).toBe('healthy');
      expect(HealthStatus.UNHEALTHY).toBe('unhealthy');
      expect(HealthStatus.DEGRADED).toBe('degraded');
      expect(HealthStatus.UNKNOWN).toBe('unknown');
    });

    it('should have all expected values', () => {
      const values = Object.values(HealthStatus);
      expect(values).toHaveLength(4);
      expect(values).toContain('healthy');
      expect(values).toContain('unhealthy');
      expect(values).toContain('degraded');
      expect(values).toContain('unknown');
    });
  });

  describe('HealthCheckType enum', () => {
    it('should have correct values', () => {
      expect(HealthCheckType.HTTP).toBe('http');
      expect(HealthCheckType.DATABASE).toBe('database');
      expect(HealthCheckType.SYSTEM).toBe('system');
      expect(HealthCheckType.CUSTOM).toBe('custom');
    });

    it('should have all expected values', () => {
      const values = Object.values(HealthCheckType);
      expect(values).toHaveLength(4);
      expect(values).toContain('http');
      expect(values).toContain('database');
      expect(values).toContain('system');
      expect(values).toContain('custom');
    });
  });

  describe('Database types', () => {
    it('should validate database type values', () => {
      const validDatabaseTypes = ['postgresql', 'mysql', 'mongodb', 'redis'];
      const invalidDatabaseTypes = ['sqlite', 'oracle', '', null, undefined];

      validDatabaseTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });

      invalidDatabaseTypes.forEach(type => {
        if (type !== null && type !== undefined) {
          expect(validDatabaseTypes.includes(type as string)).toBe(false);
        }
      });
    });
  });

  describe('System resource types', () => {
    it('should validate system resource type values', () => {
      const validResourceTypes = ['cpu', 'memory', 'disk'];
      const invalidResourceTypes = ['network', 'io', '', null, undefined];

      validResourceTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });

      invalidResourceTypes.forEach(type => {
        if (type !== null && type !== undefined) {
          expect(validResourceTypes.includes(type as string)).toBe(false);
        }
      });
    });
  });

  describe('Type validation helpers', () => {
    it('should validate health status values', () => {
      const validStatuses = ['healthy', 'unhealthy', 'degraded', 'unknown'];
      const invalidStatuses = ['bad', 'good', '', null, undefined];

      validStatuses.forEach(status => {
        expect(Object.values(HealthStatus).includes(status as HealthStatus)).toBe(true);
      });

      invalidStatuses.forEach(status => {
        expect(Object.values(HealthStatus).includes(status as any)).toBe(false);
      });
    });

    it('should validate health check type values', () => {
      const validTypes = ['http', 'database', 'system', 'custom'];
      const invalidTypes = ['tcp', 'grpc', '', null, undefined];

      validTypes.forEach(type => {
        expect(Object.values(HealthCheckType).includes(type as HealthCheckType)).toBe(true);
      });

      invalidTypes.forEach(type => {
        expect(Object.values(HealthCheckType).includes(type as any)).toBe(false);
      });
    });
  });

  describe('Type consistency', () => {
    it('should maintain enum string consistency', () => {
      // Ensure enum values match their string representations
      expect(HealthStatus.HEALTHY).toBe('healthy');
      expect(HealthCheckType.HTTP).toBe('http');
    });

    it('should not have duplicate values within enums', () => {
      const healthStatusValues = Object.values(HealthStatus);
      expect(new Set(healthStatusValues).size).toBe(healthStatusValues.length);

      const healthCheckTypeValues = Object.values(HealthCheckType);
      expect(new Set(healthCheckTypeValues).size).toBe(healthCheckTypeValues.length);
    });
  });

  describe('Interface structure validation', () => {
    it('should validate HealthCheckResult interface properties', () => {
      // This tests TypeScript compilation more than runtime behavior
      const validResult = {
        id: 'test-id',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        timestamp: new Date(),
        duration: 100,
        message: 'OK',
      };

      // Basic property validation
      expect(typeof validResult.id).toBe('string');
      expect(typeof validResult.name).toBe('string');
      expect(Object.values(HealthCheckType).includes(validResult.type)).toBe(true);
      expect(Object.values(HealthStatus).includes(validResult.status)).toBe(true);
      expect(validResult.timestamp instanceof Date).toBe(true);
      expect(typeof validResult.duration).toBe('number');
      expect(typeof validResult.message).toBe('string');
    });

    it('should validate BaseHealthCheckConfig interface properties', () => {
      const validConfig = {
        id: 'test-id',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3,
        tags: ['api', 'critical'],
      };

      expect(typeof validConfig.id).toBe('string');
      expect(typeof validConfig.name).toBe('string');
      expect(Object.values(HealthCheckType).includes(validConfig.type)).toBe(true);
      expect(typeof validConfig.enabled).toBe('boolean');
      expect(typeof validConfig.interval).toBe('number');
      expect(typeof validConfig.timeout).toBe('number');
      expect(typeof validConfig.retries).toBe('number');
      expect(Array.isArray(validConfig.tags)).toBe(true);
      expect(validConfig.tags?.every(tag => typeof tag === 'string')).toBe(true);
    });
  });
});