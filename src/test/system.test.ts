import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs/promises';
import { SystemHealthChecker } from '../checkers/system';
import { HealthCheckType, HealthStatus, SystemHealthCheckConfig } from '../types';

// Mock os and fs modules
vi.mock('os');
vi.mock('fs/promises');

const mockedOs = vi.mocked(os);
const mockedFs = vi.mocked(fs);

describe('SystemHealthChecker', () => {
  let checker: SystemHealthChecker;
  let mockConfig: SystemHealthCheckConfig;

  beforeEach(() => {
    checker = new SystemHealthChecker();
    mockConfig = {
      id: 'test-system',
      name: 'Test System Check',
      type: HealthCheckType.SYSTEM,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 1,
      checks: [
        { type: 'memory', threshold: 80 },
        { type: 'cpu', threshold: 90 },
        { type: 'disk', threshold: 85, path: '/' },
      ],
    };
  });

  describe('getType', () => {
    it('should return SYSTEM type', () => {
      expect(checker.getType()).toBe(HealthCheckType.SYSTEM);
    });
  });

  describe('memory checks', () => {
    it('should return healthy status when memory usage is below threshold', async () => {
      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      // Mock 8GB total, 2GB free (75% usage)
      mockedOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      mockedOs.freemem.mockReturnValue(2 * 1024 * 1024 * 1024);

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.memoryUsagePercent).toBe(75);
    });

    it('should return degraded status when memory usage is close to threshold', async () => {
      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      // Mock 8GB total, 1.4GB free (82.5% usage)
      mockedOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      mockedOs.freemem.mockReturnValue(1.4 * 1024 * 1024 * 1024);

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.metadata?.memoryUsagePercent).toBe(82.5);
    });

    it('should return unhealthy status when memory usage exceeds threshold', async () => {
      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      // Mock 8GB total, 0.8GB free (90% usage)
      mockedOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      mockedOs.freemem.mockReturnValue(0.8 * 1024 * 1024 * 1024);

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.metadata?.memoryUsagePercent).toBe(90);
      expect(result.message).toContain('Memory usage (90.00%) exceeds threshold (80%)');
    });
  });

  describe('CPU checks', () => {
    it('should return healthy status when CPU usage is below threshold', async () => {
      const cpuConfig = {
        ...mockConfig,
        checks: [{ type: 'cpu' as const, threshold: 90 }],
      };

      // Mock 4 CPUs with load average of 2.0 (50% usage)
      mockedOs.loadavg.mockReturnValue([2.0, 2.2, 2.5]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any);

      const result = await checker.check(cpuConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.cpuLoadPercent).toBe(50);
    });

    it('should return degraded status when CPU usage is close to threshold', async () => {
      const cpuConfig = {
        ...mockConfig,
        checks: [{ type: 'cpu' as const, threshold: 90 }],
      };

      // Mock 4 CPUs with load average of 3.6 (90% usage)
      mockedOs.loadavg.mockReturnValue([3.6, 3.4, 3.2]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any);

      const result = await checker.check(cpuConfig);

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.metadata?.cpuLoadPercent).toBe(90);
    });

    it('should return unhealthy status when CPU usage exceeds threshold', async () => {
      const cpuConfig = {
        ...mockConfig,
        checks: [{ type: 'cpu' as const, threshold: 90 }],
      };

      // Mock 4 CPUs with load average of 4.0 (100% usage)
      mockedOs.loadavg.mockReturnValue([4.0, 3.8, 3.5]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any);

      const result = await checker.check(cpuConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.metadata?.cpuLoadPercent).toBe(100);
      expect(result.message).toContain('CPU usage (100.00%) exceeds threshold (90%)');
    });

    it('should handle null load average values', async () => {
      const cpuConfig = {
        ...mockConfig,
        checks: [{ type: 'cpu' as const, threshold: 90 }],
      };

      // Mock loadavg with potential null values
      mockedOs.loadavg.mockReturnValue([null as any, 2.2, 2.5]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any);

      const result = await checker.check(cpuConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.cpuLoadPercent).toBe(0);
    });
  });

  describe('disk checks', () => {
    it('should return healthy status when disk usage is below threshold', async () => {
      const diskConfig = {
        ...mockConfig,
        checks: [{ type: 'disk' as const, threshold: 85, path: '/' }],
      };

      // Mock disk stats: 100GB total, 70GB used (70% usage)
      const mockStats = {
        size: 100 * 1024 * 1024 * 1024, // 100GB
        used: 70 * 1024 * 1024 * 1024,  // 70GB
      };
      
      mockedFs.stat.mockResolvedValue({} as any);
      mockedFs.readdir.mockResolvedValue([]);
      
      // Mock the disk usage calculation by spying on the method
      const calculateDiskUsageSpy = vi.spyOn(checker as any, 'calculateDiskUsage');
      calculateDiskUsageSpy.mockResolvedValue(mockStats);

      const result = await checker.check(diskConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.diskUsagePercent).toBe(70);
    });

    it('should return degraded status when disk usage is close to threshold', async () => {
      const diskConfig = {
        ...mockConfig,
        checks: [{ type: 'disk' as const, threshold: 85, path: '/' }],
      };

      const mockStats = {
        size: 100 * 1024 * 1024 * 1024, // 100GB
        used: 85 * 1024 * 1024 * 1024,  // 85GB (85% usage)
      };
      
      mockedFs.stat.mockResolvedValue({} as any);
      
      const calculateDiskUsageSpy = vi.spyOn(checker as any, 'calculateDiskUsage');
      calculateDiskUsageSpy.mockResolvedValue(mockStats);

      const result = await checker.check(diskConfig);

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.metadata?.diskUsagePercent).toBe(85);
    });

    it('should return unhealthy status when disk usage exceeds threshold', async () => {
      const diskConfig = {
        ...mockConfig,
        checks: [{ type: 'disk' as const, threshold: 85, path: '/' }],
      };

      const mockStats = {
        size: 100 * 1024 * 1024 * 1024, // 100GB
        used: 95 * 1024 * 1024 * 1024,  // 95GB (95% usage)
      };
      
      mockedFs.stat.mockResolvedValue({} as any);
      
      const calculateDiskUsageSpy = vi.spyOn(checker as any, 'calculateDiskUsage');
      calculateDiskUsageSpy.mockResolvedValue(mockStats);

      const result = await checker.check(diskConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.metadata?.diskUsagePercent).toBe(95);
      expect(result.message).toContain('Disk usage (95.00%) exceeds threshold (85%) for path /');
    });

    it('should handle disk access errors', async () => {
      const diskConfig = {
        ...mockConfig,
        checks: [{ type: 'disk' as const, threshold: 85, path: '/nonexistent' }],
      };

      mockedFs.stat.mockRejectedValue(new Error('Path not found'));

      const result = await checker.check(diskConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toContain('Path not found');
    });
  });

  describe('combined checks', () => {
    it('should return the worst status among all checks', async () => {
      // Set up mocks for all check types
      mockedOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      mockedOs.freemem.mockReturnValue(6 * 1024 * 1024 * 1024); // 25% usage (healthy)
      mockedOs.loadavg.mockReturnValue([1.0, 1.2, 1.5]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any); // 25% usage (healthy)
      
      mockedFs.stat.mockResolvedValue({} as any);
      
      const mockDiskStats = {
        size: 100 * 1024 * 1024 * 1024,
        used: 95 * 1024 * 1024 * 1024, // 95% usage (unhealthy)
      };
      
      const calculateDiskUsageSpy = vi.spyOn(checker as any, 'calculateDiskUsage');
      calculateDiskUsageSpy.mockResolvedValue(mockDiskStats);

      const result = await checker.check(mockConfig);

      // Should return unhealthy because disk usage is the worst
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.metadata?.memoryUsagePercent).toBe(25);
      expect(result.metadata?.cpuLoadPercent).toBe(25);
      expect(result.metadata?.diskUsagePercent).toBe(95);
    });

    it('should return healthy when all checks pass', async () => {
      // Set up mocks for healthy system
      mockedOs.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
      mockedOs.freemem.mockReturnValue(6 * 1024 * 1024 * 1024); // 25% usage
      mockedOs.loadavg.mockReturnValue([1.0, 1.2, 1.5]);
      mockedOs.cpus.mockReturnValue(new Array(4).fill({}) as any); // 25% usage
      
      mockedFs.stat.mockResolvedValue({} as any);
      
      const mockDiskStats = {
        size: 100 * 1024 * 1024 * 1024,
        used: 50 * 1024 * 1024 * 1024, // 50% usage
      };
      
      const calculateDiskUsageSpy = vi.spyOn(checker as any, 'calculateDiskUsage');
      calculateDiskUsageSpy.mockResolvedValue(mockDiskStats);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
    });
  });

  describe('error handling', () => {
    it('should handle system call errors', async () => {
      mockedOs.totalmem.mockImplementation(() => {
        throw new Error('System call failed');
      });

      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('System call failed');
    });

    it('should retry on failures', async () => {
      let callCount = 0;
      mockedOs.totalmem.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        return 8 * 1024 * 1024 * 1024;
      });
      mockedOs.freemem.mockReturnValue(2 * 1024 * 1024 * 1024);

      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.retryCount).toBe(2);
    });

    it('should handle unknown error types', async () => {
      mockedOs.totalmem.mockImplementation(() => {
        throw 'String error';
      });

      const memoryConfig = {
        ...mockConfig,
        checks: [{ type: 'memory' as const, threshold: 80 }],
      };

      const result = await checker.check(memoryConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Unknown system error occurred');
    });
  });
});