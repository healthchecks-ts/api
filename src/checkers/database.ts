import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Redis from 'redis';
import {
  HealthChecker,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckType,
  HealthStatus,
  DatabaseHealthCheckConfig,
  HealthCheckOptions,
} from '../types';

export class DatabaseHealthChecker implements HealthChecker {
  getType(): HealthCheckType {
    return HealthCheckType.DATABASE;
  }

  async check(
    config: HealthCheckConfig,
    options?: HealthCheckOptions
  ): Promise<HealthCheckResult> {
    const dbConfig = config as DatabaseHealthCheckConfig;
    const startTime = Date.now();
    const timestamp = new Date();
    const timeout = options?.timeout || config.timeout || 5000;
    const maxRetries = options?.retries || config.retries || 0;
    const retryDelay = options?.retryDelay || 1000;

    let lastError: string | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performDatabaseCheck(dbConfig, timeout);
        const duration = Date.now() - startTime;

        return {
          id: config.id,
          name: config.name,
          type: config.type,
          status: result.status,
          timestamp,
          duration,
          message: result.message,
          metadata: {
            databaseType: dbConfig.databaseType,
            responseTime: result.responseTime,
            ...(result.metadata && result.metadata),
          },
          retryCount,
        };
      } catch (error) {
        retryCount = attempt;
        lastError = this.extractErrorMessage(error);

        if (attempt < maxRetries) {
          await this.delay(retryDelay);
        }
      }
    }

    const duration = Date.now() - startTime;
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      status: HealthStatus.UNHEALTHY,
      timestamp,
      duration,
      ...(lastError && { error: lastError }),
      metadata: {
        databaseType: dbConfig.databaseType,
      },
      retryCount,
    };
  }

  private async performDatabaseCheck(
    config: DatabaseHealthCheckConfig,
    timeout: number
  ): Promise<{
    status: HealthStatus;
    message: string;
    responseTime: number;
    metadata?: Record<string, unknown>;
  }> {
    const startTime = Date.now();

    switch (config.databaseType) {
      case 'postgresql':
        return await this.checkPostgreSQL(config, timeout, startTime);
      case 'mysql':
        return await this.checkMySQL(config, timeout, startTime);
      case 'mongodb':
        return await this.checkMongoDB(config, timeout, startTime);
      case 'redis':
        return await this.checkRedis(config, timeout, startTime);
      default:
        throw new Error(`Unsupported database type: ${config.databaseType}`);
    }
  }

  private async checkPostgreSQL(
    config: DatabaseHealthCheckConfig,
    timeout: number,
    startTime: number
  ): Promise<{
    status: HealthStatus;
    message: string;
    responseTime: number;
    metadata?: Record<string, unknown>;
  }> {
    const client = new PgClient({
      connectionString: config.connectionString,
      connectionTimeoutMillis: timeout,
    });

    try {
      await client.connect();
      
      const query = config.query || 'SELECT 1';
      const result = await client.query(query);
      
      const responseTime = Date.now() - startTime;
      await client.end();

      let status = HealthStatus.HEALTHY;
      if (responseTime > timeout * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      // Check expected result if specified
      if (config.expectedResult !== undefined) {
        const actualResult = result.rows[0];
        if (JSON.stringify(actualResult) !== JSON.stringify(config.expectedResult)) {
          status = HealthStatus.UNHEALTHY;
        }
      }

      return {
        status,
        message: 'PostgreSQL connection successful',
        responseTime,
        metadata: {
          rowCount: result.rowCount,
        },
      };
    } catch (error) {
      await client.end().catch(() => {});
      throw error;
    }
  }

  private async checkMySQL(
    config: DatabaseHealthCheckConfig,
    timeout: number,
    startTime: number
  ): Promise<{
    status: HealthStatus;
    message: string;
    responseTime: number;
    metadata?: Record<string, unknown>;
  }> {
    const connection = await mysql.createConnection(config.connectionString);

    try {
      const query = config.query || 'SELECT 1';
      const [rows] = await connection.execute(query);
      
      const responseTime = Date.now() - startTime;
      await connection.end();

      let status = HealthStatus.HEALTHY;
      if (responseTime > timeout * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        status,
        message: 'MySQL connection successful',
        responseTime,
        metadata: {
          rowCount: Array.isArray(rows) ? rows.length : 0,
        },
      };
    } catch (error) {
      await connection.end().catch(() => {});
      throw error;
    }
  }

  private async checkMongoDB(
    config: DatabaseHealthCheckConfig,
    timeout: number,
    startTime: number
  ): Promise<{
    status: HealthStatus;
    message: string;
    responseTime: number;
    metadata?: Record<string, unknown>;
  }> {
    const client = new MongoClient(config.connectionString, {
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
    });

    try {
      await client.connect();
      
      // Ping the database to ensure connection is working
      await client.db().admin().ping();
      
      const responseTime = Date.now() - startTime;
      await client.close();

      let status = HealthStatus.HEALTHY;
      if (responseTime > timeout * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        status,
        message: 'MongoDB connection successful',
        responseTime,
      };
    } catch (error) {
      await client.close().catch(() => {});
      throw error;
    }
  }

  private async checkRedis(
    config: DatabaseHealthCheckConfig,
    timeout: number,
    startTime: number
  ): Promise<{
    status: HealthStatus;
    message: string;
    responseTime: number;
    metadata?: Record<string, unknown>;
  }> {
    const client = Redis.createClient({
      url: config.connectionString,
      socket: {
        connectTimeout: timeout,
      },
    });

    try {
      await client.connect();
      
      // Ping the Redis server
      const pong = await client.ping();
      
      const responseTime = Date.now() - startTime;
      await client.disconnect();

      let status = HealthStatus.HEALTHY;
      if (responseTime > timeout * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        status,
        message: 'Redis connection successful',
        responseTime,
        metadata: {
          pong,
        },
      };
    } catch (error) {
      await client.disconnect().catch(() => {});
      throw error;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown database error occurred';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}