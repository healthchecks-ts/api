import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseHealthChecker } from '../checkers/database';
import { HealthCheckType, HealthStatus, DatabaseHealthCheckConfig } from '../types';

// Mock database clients
vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
  })),
}));

vi.mock('mysql2/promise', () => ({
  default: {
    createConnection: vi.fn(),
  },
}));

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    db: vi.fn(() => ({
      admin: vi.fn(() => ({
        ping: vi.fn(),
      })),
    })),
    close: vi.fn(),
  })),
}));

vi.mock('redis', () => ({
  default: {
    createClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn(),
      ping: vi.fn(),
      disconnect: vi.fn(),
    })),
  },
}));

describe('DatabaseHealthChecker', () => {
  let checker: DatabaseHealthChecker;
  let mockPgConfig: DatabaseHealthCheckConfig;
  let mockMysqlConfig: DatabaseHealthCheckConfig;
  let mockMongoConfig: DatabaseHealthCheckConfig;
  let mockRedisConfig: DatabaseHealthCheckConfig;

  beforeEach(() => {
    checker = new DatabaseHealthChecker();
    
    mockPgConfig = {
      id: 'test-postgres',
      name: 'Test PostgreSQL',
      type: HealthCheckType.DATABASE,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 2,
      connectionString: 'postgresql://user:pass@localhost:5432/test',
      databaseType: 'postgresql',
    };

    mockMysqlConfig = {
      id: 'test-mysql',
      name: 'Test MySQL',
      type: HealthCheckType.DATABASE,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 2,
      connectionString: 'mysql://user:pass@localhost:3306/test',
      databaseType: 'mysql',
    };

    mockMongoConfig = {
      id: 'test-mongo',
      name: 'Test MongoDB',
      type: HealthCheckType.DATABASE,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 2,
      connectionString: 'mongodb://localhost:27017/test',
      databaseType: 'mongodb',
    };

    mockRedisConfig = {
      id: 'test-redis',
      name: 'Test Redis',
      type: HealthCheckType.DATABASE,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 2,
      connectionString: 'redis://localhost:6379',
      databaseType: 'redis',
    };
  });

  describe('getType', () => {
    it('should return DATABASE type', () => {
      expect(checker.getType()).toBe(HealthCheckType.DATABASE);
    });
  });

  describe('PostgreSQL checks', () => {
    it('should return healthy status for successful PostgreSQL connection', async () => {
      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [{ test: 1 }], rowCount: 1 }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockPgConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.id).toBe(mockPgConfig.id);
      expect(result.type).toBe(HealthCheckType.DATABASE);
      expect(result.metadata?.databaseType).toBe('postgresql');
      expect(result.metadata?.rowCount).toBe(1);
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should execute custom query for PostgreSQL', async () => {
      const configWithQuery = {
        ...mockPgConfig,
        query: 'SELECT COUNT(*) FROM users',
      };

      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [{ count: 10 }], rowCount: 1 }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(configWithQuery);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM users');
    });

    it('should return degraded status for slow PostgreSQL response', async () => {
      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockImplementation(() => 
          new Promise((resolve) => {
            setTimeout(() => resolve({ rows: [{ test: 1 }], rowCount: 1 }), 4500);
          })
        ),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockPgConfig);

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.duration).toBeGreaterThan(4000);
    });

    it('should handle PostgreSQL connection errors', async () => {
      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockPgConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Connection failed');
      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('MySQL checks', () => {
    it('should return healthy status for successful MySQL connection', async () => {
      const mysql = await import('mysql2/promise');
      const mockConnection = {
        execute: vi.fn().mockResolvedValue([[{ test: 1 }], []]),
        end: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(mysql.default.createConnection).mockResolvedValue(mockConnection as any);

      const result = await checker.check(mockMysqlConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.databaseType).toBe('mysql');
      expect(result.metadata?.rowCount).toBe(1);
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT 1');
      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should handle MySQL connection errors', async () => {
      const mysql = await import('mysql2/promise');
      vi.mocked(mysql.default.createConnection).mockRejectedValue(new Error('MySQL connection failed'));

      const result = await checker.check(mockMysqlConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('MySQL connection failed');
    });
  });

  describe('MongoDB checks', () => {
    it('should return healthy status for successful MongoDB connection', async () => {
      const { MongoClient } = await import('mongodb');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        db: vi.fn(() => ({
          admin: vi.fn(() => ({
            ping: vi.fn().mockResolvedValue({}),
          })),
        })),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(MongoClient).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockMongoConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.databaseType).toBe('mongodb');
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should handle MongoDB connection errors', async () => {
      const { MongoClient } = await import('mongodb');
      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error('MongoDB connection failed')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(MongoClient).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockMongoConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('MongoDB connection failed');
      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe('Redis checks', () => {
    it('should return healthy status for successful Redis connection', async () => {
      const Redis = await import('redis');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue('PONG'),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Redis.default.createClient).mockReturnValue(mockClient as any);

      const result = await checker.check(mockRedisConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.metadata?.databaseType).toBe('redis');
      expect(result.metadata?.pong).toBe('PONG');
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.ping).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle Redis connection errors', async () => {
      const Redis = await import('redis');
      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Redis.default.createClient).mockReturnValue(mockClient as any);

      const result = await checker.check(mockRedisConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Redis connection failed');
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle unsupported database type', async () => {
      const unsupportedConfig = {
        ...mockPgConfig,
        databaseType: 'unsupported' as any,
      };

      const result = await checker.check(unsupportedConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toContain('Unsupported database type');
    });

    it('should retry on database failures', async () => {
      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockResolvedValueOnce(undefined),
        query: vi.fn().mockResolvedValue({ rows: [{ test: 1 }], rowCount: 1 }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockPgConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.retryCount).toBe(2);
      expect(mockClient.connect).toHaveBeenCalledTimes(3);
    });

    it('should handle unknown database errors', async () => {
      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockRejectedValue('Unknown error'),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(mockPgConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Unknown database error occurred');
    });

    it('should validate expected result for PostgreSQL', async () => {
      const configWithExpectedResult = {
        ...mockPgConfig,
        expectedResult: { test: 1 },
      };

      const { Client } = await import('pg');
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [{ test: 2 }], rowCount: 1 }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      
      vi.mocked(Client).mockImplementation(() => mockClient as any);

      const result = await checker.check(configWithExpectedResult);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });
  });
});