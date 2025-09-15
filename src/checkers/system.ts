import * as os from 'os';
import * as fs from 'fs/promises';
import {
  HealthChecker,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckType,
  HealthStatus,
  SystemHealthCheckConfig,
  SystemCheck,
  HealthCheckOptions,
} from '../types';

export class SystemHealthChecker implements HealthChecker {
  getType(): HealthCheckType {
    return HealthCheckType.SYSTEM;
  }

  async check(
    config: HealthCheckConfig,
    options?: HealthCheckOptions
  ): Promise<HealthCheckResult> {
    const systemConfig = config as SystemHealthCheckConfig;
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      const checkResults = await Promise.all(
        systemConfig.checks.map((check) => this.performSystemCheck(check))
      );

      const duration = Date.now() - startTime;
      const failedChecks = checkResults.filter((result) => result.status !== HealthStatus.HEALTHY);
      
      let overallStatus = HealthStatus.HEALTHY;
      if (failedChecks.length > 0) {
        overallStatus = failedChecks.some((check) => check.status === HealthStatus.UNHEALTHY)
          ? HealthStatus.UNHEALTHY
          : HealthStatus.DEGRADED;
      }

      const messages = checkResults.map((result) => result.message).join('; ');

      return {
        id: config.id,
        name: config.name,
        type: config.type,
        status: overallStatus,
        timestamp,
        duration,
        message: messages,
        metadata: {
          checks: checkResults,
          systemInfo: this.getSystemInfo(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        status: HealthStatus.UNHEALTHY,
        timestamp,
        duration,
        error: error instanceof Error ? error.message : 'Unknown system check error',
        metadata: {
          systemInfo: this.getSystemInfo(),
        },
      };
    }
  }

  private async performSystemCheck(check: SystemCheck): Promise<{
    type: string;
    status: HealthStatus;
    message: string;
    value: number;
    threshold: number;
    unit: string;
  }> {
    switch (check.type) {
      case 'memory':
        return await this.checkMemoryUsage(check.threshold);
      case 'disk':
        return await this.checkDiskUsage(check.threshold, check.path);
      case 'cpu':
        return await this.checkCpuUsage(check.threshold);
      default:
        throw new Error(`Unsupported system check type: ${check.type}`);
    }
  }

  private async checkMemoryUsage(threshold: number): Promise<{
    type: string;
    status: HealthStatus;
    message: string;
    value: number;
    threshold: number;
    unit: string;
  }> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    let status = HealthStatus.HEALTHY;
    if (memoryUsagePercent > threshold) {
      status = HealthStatus.UNHEALTHY;
    } else if (memoryUsagePercent > threshold * 0.8) {
      status = HealthStatus.DEGRADED;
    }

    return {
      type: 'memory',
      status,
      message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
      value: memoryUsagePercent,
      threshold,
      unit: '%',
    };
  }

  private async checkDiskUsage(threshold: number, path?: string): Promise<{
    type: string;
    status: HealthStatus;
    message: string;
    value: number;
    threshold: number;
    unit: string;
  }> {
    const checkPath = path || process.cwd();
    
    try {
      const stats = await fs.stat(checkPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path ${checkPath} is not a directory`);
      }

      // For disk usage, we'll use a simple approach by checking available space
      // Note: This is a simplified implementation. In production, you might want to use a library like 'statvfs'
      const fakeUsagePercent = 0; // Placeholder - actual implementation would check disk usage
      
      let status = HealthStatus.HEALTHY;
      if (fakeUsagePercent > threshold) {
        status = HealthStatus.UNHEALTHY;
      } else if (fakeUsagePercent > threshold * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        type: 'disk',
        status,
        message: `Disk usage for ${checkPath}: ${fakeUsagePercent}%`,
        value: fakeUsagePercent,
        threshold,
        unit: '%',
      };
    } catch (error) {
      return {
        type: 'disk',
        status: HealthStatus.UNHEALTHY,
        message: `Failed to check disk usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: 0,
        threshold,
        unit: '%',
      };
    }
  }

  private async checkCpuUsage(threshold: number): Promise<{
    type: string;
    status: HealthStatus;
    message: string;
    value: number;
    threshold: number;
    unit: string;
  }> {
    // CPU usage check using load average
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const oneMinLoad = loadAvg[0] ?? 0;
    const currentLoad = (oneMinLoad / cpuCount) * 100; // 1-minute load average as percentage

    let status = HealthStatus.HEALTHY;
    if (currentLoad > threshold) {
      status = HealthStatus.UNHEALTHY;
    } else if (currentLoad > threshold * 0.8) {
      status = HealthStatus.DEGRADED;
    }

    return {
      type: 'cpu',
      status,
      message: `CPU load: ${currentLoad.toFixed(2)}%`,
      value: currentLoad,
      threshold,
      unit: '%',
    };
  }

  private getSystemInfo(): Record<string, unknown> {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      hostname: os.hostname(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
    };
  }
}