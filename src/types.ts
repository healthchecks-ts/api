export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
}

export enum HealthCheckType {
  HTTP = 'http',
  DATABASE = 'database',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface HealthCheckConfig {
  id: string;
  name: string;
  type: HealthCheckType;
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface HttpHealthCheckConfig extends HealthCheckConfig {
  type: HealthCheckType.HTTP;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  expectedStatusCodes?: number[];
  expectedBody?: string | RegExp;
  followRedirects?: boolean;
}

export interface DatabaseHealthCheckConfig extends HealthCheckConfig {
  type: HealthCheckType.DATABASE;
  connectionString: string;
  databaseType: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  query?: string;
  expectedResult?: unknown;
}

export interface SystemHealthCheckConfig extends HealthCheckConfig {
  type: HealthCheckType.SYSTEM;
  checks: SystemCheck[];
}

export interface SystemCheck {
  type: 'memory' | 'disk' | 'cpu';
  threshold: number; // percentage for memory/cpu, bytes for disk
  path?: string; // for disk checks
}

export interface HealthCheckResult {
  id: string;
  name: string;
  type: HealthCheckType;
  status: HealthStatus;
  timestamp: Date;
  duration: number; // milliseconds
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

export interface HealthSummary {
  status: HealthStatus;
  timestamp: Date;
  totalChecks: number;
  healthyChecks: number;
  unhealthyChecks: number;
  degradedChecks: number;
  unknownChecks: number;
  checks: HealthCheckResult[];
}

export interface HealthCheckMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageResponseTime: number;
  lastExecutionTime: Date;
  uptime: number; // percentage
}

export interface HealthCheckRegistry {
  [key: string]: HealthCheckConfig;
}

export interface HealthCheckOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HealthChecker {
  check(config: HealthCheckConfig, options?: HealthCheckOptions): Promise<HealthCheckResult>;
  getType(): HealthCheckType;
}

export interface HealthCheckService {
  registerCheck(config: HealthCheckConfig): void;
  unregisterCheck(id: string): void;
  executeCheck(id: string): Promise<HealthCheckResult>;
  executeAllChecks(): Promise<HealthSummary>;
  getCheckStatus(id: string): Promise<HealthCheckResult | null>;
  getHealthSummary(): Promise<HealthSummary>;
  getMetrics(id?: string): Promise<HealthCheckMetrics | Record<string, HealthCheckMetrics>>;
}