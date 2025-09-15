import {
  HealthCheckService,
  HealthCheckConfig,
  HealthCheckResult,
  HealthSummary,
  HealthCheckMetrics,
  HealthStatus,
  HealthCheckType,
  HealthChecker,
  HealthCheckRegistry,
} from '../types';
import { HttpHealthChecker } from '../checkers/http';
import { DatabaseHealthChecker } from '../checkers/database';
import { SystemHealthChecker } from '../checkers/system';

export class HealthCheckOrchestrator implements HealthCheckService {
  private registry: HealthCheckRegistry = {};
  private checkers: Map<HealthCheckType, HealthChecker> = new Map();
  private results: Map<string, HealthCheckResult[]> = new Map();
  private metrics: Map<string, HealthCheckMetrics> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeCheckers();
  }

  private initializeCheckers(): void {
    this.checkers.set(HealthCheckType.HTTP, new HttpHealthChecker());
    this.checkers.set(HealthCheckType.DATABASE, new DatabaseHealthChecker());
    this.checkers.set(HealthCheckType.SYSTEM, new SystemHealthChecker());
  }

  registerCheck(config: HealthCheckConfig): void {
    this.registry[config.id] = config;
    
    // Initialize metrics for this check
    this.metrics.set(config.id, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      lastExecutionTime: new Date(),
      uptime: 100,
    });

    // Set up periodic execution if enabled
    if (config.enabled && config.interval > 0) {
      this.schedulePeriodicCheck(config);
    }
  }

  unregisterCheck(id: string): void {
    delete this.registry[id];
    this.results.delete(id);
    this.metrics.delete(id);
    
    // Clear interval if exists
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  async executeCheck(id: string): Promise<HealthCheckResult> {
    const config = this.registry[id];
    if (!config) {
      throw new Error(`Health check with id '${id}' not found`);
    }

    const checker = this.checkers.get(config.type);
    if (!checker) {
      throw new Error(`No checker available for type '${config.type}'`);
    }

    const result = await checker.check(config);
    
    // Store result
    this.storeResult(id, result);
    
    // Update metrics
    this.updateMetrics(id, result);

    return result;
  }

  async executeAllChecks(): Promise<HealthSummary> {
    const enabledConfigs = Object.values(this.registry).filter((config) => config.enabled);
    
    const results = await Promise.allSettled(
      enabledConfigs.map((config) => this.executeCheck(config.id))
    );

    const checkResults: HealthCheckResult[] = [];
    let healthyCount = 0;
    let unhealthyCount = 0;
    let degradedCount = 0;
    let unknownCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const checkResult = result.value;
        checkResults.push(checkResult);
        
        switch (checkResult.status) {
          case HealthStatus.HEALTHY:
            healthyCount++;
            break;
          case HealthStatus.UNHEALTHY:
            unhealthyCount++;
            break;
          case HealthStatus.DEGRADED:
            degradedCount++;
            break;
          default:
            unknownCount++;
        }
      } else {
        // Handle failed check execution
        const config = enabledConfigs[index];
        if (config) {
          const failedResult: HealthCheckResult = {
            id: config.id,
            name: config.name,
            type: config.type,
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date(),
            duration: 0,
            error: `Failed to execute check: ${result.reason}`,
          };
          checkResults.push(failedResult);
          unhealthyCount++;
        }
      }
    });

    // Determine overall status
    let overallStatus = HealthStatus.HEALTHY;
    if (unhealthyCount > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedCount > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (unknownCount > 0 && healthyCount === 0) {
      overallStatus = HealthStatus.UNKNOWN;
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      totalChecks: checkResults.length,
      healthyChecks: healthyCount,
      unhealthyChecks: unhealthyCount,
      degradedChecks: degradedCount,
      unknownChecks: unknownCount,
      checks: checkResults,
    };
  }

  async getCheckStatus(id: string): Promise<HealthCheckResult | null> {
    const results = this.results.get(id);
    if (!results || results.length === 0) {
      return null;
    }
    const lastResult = results[results.length - 1];
    return lastResult ?? null; // Return most recent result
  }

  async getHealthSummary(): Promise<HealthSummary> {
    return this.executeAllChecks();
  }

  async getMetrics(id?: string): Promise<HealthCheckMetrics | Record<string, HealthCheckMetrics>> {
    if (id) {
      const metrics = this.metrics.get(id);
      if (!metrics) {
        throw new Error(`No metrics found for health check '${id}'`);
      }
      return metrics;
    }

    const allMetrics: Record<string, HealthCheckMetrics> = {};
    this.metrics.forEach((metrics, checkId) => {
      allMetrics[checkId] = metrics;
    });
    return allMetrics;
  }

  private schedulePeriodicCheck(config: HealthCheckConfig): void {
    // Clear existing interval if any
    const existingInterval = this.intervals.get(config.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Schedule new interval
    const interval = setInterval(async () => {
      try {
        await this.executeCheck(config.id);
      } catch (error) {
        console.error(`Periodic check failed for '${config.id}':`, error);
      }
    }, config.interval);

    this.intervals.set(config.id, interval);
  }

  private storeResult(id: string, result: HealthCheckResult): void {
    const results = this.results.get(id) || [];
    results.push(result);
    
    // Keep only last 100 results to prevent memory bloat
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }
    
    this.results.set(id, results);
  }

  private updateMetrics(id: string, result: HealthCheckResult): void {
    const metrics = this.metrics.get(id);
    if (!metrics) {
      return;
    }

    metrics.totalExecutions++;
    metrics.lastExecutionTime = result.timestamp;

    if (result.status === HealthStatus.HEALTHY || result.status === HealthStatus.DEGRADED) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    // Update average response time
    const currentAvg = metrics.averageResponseTime;
    const newAvg = ((currentAvg * (metrics.totalExecutions - 1)) + result.duration) / metrics.totalExecutions;
    metrics.averageResponseTime = Math.round(newAvg * 100) / 100; // Round to 2 decimal places

    // Calculate uptime percentage
    metrics.uptime = Math.round((metrics.successfulExecutions / metrics.totalExecutions) * 100 * 100) / 100;

    this.metrics.set(id, metrics);
  }

  // Cleanup method to clear all intervals
  dispose(): void {
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }

  // Get all registered checks
  getRegisteredChecks(): HealthCheckConfig[] {
    return Object.values(this.registry);
  }

  // Enable/disable a specific check
  toggleCheck(id: string, enabled: boolean): void {
    const config = this.registry[id];
    if (!config) {
      throw new Error(`Health check with id '${id}' not found`);
    }

    config.enabled = enabled;

    if (enabled && config.interval > 0) {
      this.schedulePeriodicCheck(config);
    } else {
      const interval = this.intervals.get(id);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(id);
      }
    }
  }
}