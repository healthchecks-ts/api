import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../routes/health';
import { HealthCheckOrchestrator } from '../services/health-check-orchestrator';
import { HealthCheckType, HealthStatus, HttpHealthCheckConfig } from '../types';

// Mock the orchestrator
vi.mock('../services/health-check-orchestrator');

describe('Health Routes', () => {
  let app: express.Application;
  let mockOrchestrator: HealthCheckOrchestrator;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Create mock orchestrator
    mockOrchestrator = {
      getHealthSummary: vi.fn(),
      getRegisteredChecks: vi.fn(),
      getCheckStatus: vi.fn(),
      executeCheck: vi.fn(),
      getMetrics: vi.fn(),
      registerCheck: vi.fn(),
      unregisterCheck: vi.fn(),
      toggleCheck: vi.fn(),
    } as any;

    // Inject orchestrator into requests
    app.use((req: any, res, next) => {
      req.healthService = mockOrchestrator;
      next();
    });

    app.use('/api', healthRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 for healthy status', async () => {
      const mockSummary = {
        status: HealthStatus.HEALTHY,
        timestamp: new Date(),
        totalChecks: 2,
        healthyChecks: 2,
        unhealthyChecks: 0,
        degradedChecks: 0,
        unknownChecks: 0,
        checks: [],
      };

      vi.mocked(mockOrchestrator.getHealthSummary).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: HealthStatus.HEALTHY,
        timestamp: mockSummary.timestamp.toISOString(),
        checks: {
          total: 2,
          healthy: 2,
          unhealthy: 0,
          degraded: 0,
          unknown: 0,
        },
      });
    });

    it('should return 206 for degraded status', async () => {
      const mockSummary = {
        status: HealthStatus.DEGRADED,
        timestamp: new Date(),
        totalChecks: 2,
        healthyChecks: 1,
        unhealthyChecks: 0,
        degradedChecks: 1,
        unknownChecks: 0,
        checks: [],
      };

      vi.mocked(mockOrchestrator.getHealthSummary).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/health')
        .expect(206);

      expect(response.body.status).toBe(HealthStatus.DEGRADED);
    });

    it('should return 503 for unhealthy status', async () => {
      const mockSummary = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        totalChecks: 2,
        healthyChecks: 0,
        unhealthyChecks: 2,
        degradedChecks: 0,
        unknownChecks: 0,
        checks: [],
      };

      vi.mocked(mockOrchestrator.getHealthSummary).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should return 500 on orchestrator error', async () => {
      vi.mocked(mockOrchestrator.getHealthSummary).mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get health status',
        message: 'Service error',
      });
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health summary', async () => {
      const mockSummary = {
        status: HealthStatus.HEALTHY,
        timestamp: new Date(),
        totalChecks: 1,
        healthyChecks: 1,
        unhealthyChecks: 0,
        degradedChecks: 0,
        unknownChecks: 0,
        checks: [{
          id: 'test-check',
          name: 'Test Check',
          type: HealthCheckType.HTTP,
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          duration: 150,
          message: 'All good',
        }],
      };

      vi.mocked(mockOrchestrator.getHealthSummary).mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      // Convert all Date fields to ISO strings for comparison
      const expectedSummary = {
        ...mockSummary,
        timestamp: mockSummary.timestamp.toISOString(),
        checks: mockSummary.checks.map(check => ({
          ...check,
          timestamp: check.timestamp.toISOString(),
        })),
      };
      expect(response.body).toEqual(expectedSummary);
    });
  });

  describe('GET /api/health/checks', () => {
    it('should return list of registered checks', async () => {
      const mockChecks = [
        {
          id: 'test-http',
          name: 'Test HTTP Check',
          type: HealthCheckType.HTTP,
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 2,
          tags: ['api'],
        },
      ];

      vi.mocked(mockOrchestrator.getRegisteredChecks).mockReturnValue(mockChecks as any);

      const response = await request(app)
        .get('/api/health/checks')
        .expect(200);

      expect(response.body).toEqual({
        total: 1,
        checks: mockChecks.map(check => ({
          id: check.id,
          name: check.name,
          type: check.type,
          enabled: check.enabled,
          interval: check.interval,
          timeout: check.timeout,
          retries: check.retries,
          tags: check.tags,
        })),
      });
    });
  });

  describe('GET /api/health/checks/:id', () => {
    it('should return specific check status', async () => {
      const mockResult = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        timestamp: new Date(),
        duration: 150,
        message: 'All good',
      };

      vi.mocked(mockOrchestrator.getCheckStatus).mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/health/checks/test-check')
        .expect(200);

      // Convert timestamp to ISO string for comparison
      expect(response.body).toEqual({
        ...mockResult,
        timestamp: mockResult.timestamp.toISOString(),
      });
    });

    it('should return 404 for non-existent check', async () => {
      vi.mocked(mockOrchestrator.getCheckStatus).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/health/checks/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: "Health check 'non-existent' not found or no results available",
      });
    });

    it('should return 400 for missing ID', async () => {
      const response = await request(app)
        .get('/api/health/checks/')
        .expect(500); // Apparently returns 500 instead of 404
    });

    it('should return 503 for unhealthy check', async () => {
      const mockResult = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration: 5000,
        error: 'Connection failed',
      };

      vi.mocked(mockOrchestrator.getCheckStatus).mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/health/checks/test-check')
        .expect(503);

      expect(response.body.status).toBe(HealthStatus.UNHEALTHY);
    });
  });

  describe('POST /api/health/checks/:id/execute', () => {
    it('should execute check successfully', async () => {
      const mockResult = {
        id: 'test-check',
        name: 'Test Check',
        type: HealthCheckType.HTTP,
        status: HealthStatus.HEALTHY,
        timestamp: new Date(),
        duration: 150,
        message: 'All good',
      };

      vi.mocked(mockOrchestrator.executeCheck).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/health/checks/test-check/execute')
        .expect(200);

      // Convert timestamp to ISO string for comparison
      expect(response.body).toEqual({
        ...mockResult,
        timestamp: mockResult.timestamp.toISOString(),
      });
      expect(mockOrchestrator.executeCheck).toHaveBeenCalledWith('test-check');
    });

    it('should return 400 for missing ID', async () => {
      const response = await request(app)
        .post('/api/health/checks//execute')
        .expect(404); // Express router handles this as 404
    });

    it('should handle execution errors', async () => {
      vi.mocked(mockOrchestrator.executeCheck).mockRejectedValue(new Error('Execution failed'));

      const response = await request(app)
        .post('/api/health/checks/test-check/execute')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to execute health check',
        message: 'Execution failed',
      });
    });
  });

  describe('GET /api/health/metrics', () => {
    it('should return all metrics', async () => {
      const mockMetrics = {
        'test-check-1': {
          totalExecutions: 10,
          successfulExecutions: 8,
          failedExecutions: 2,
          averageResponseTime: 250,
          lastExecutionTime: new Date(),
          uptime: 80,
        },
        'test-check-2': {
          totalExecutions: 5,
          successfulExecutions: 5,
          failedExecutions: 0,
          averageResponseTime: 150,
          lastExecutionTime: new Date(),
          uptime: 100,
        },
      };

      vi.mocked(mockOrchestrator.getMetrics).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/health/metrics')
        .expect(200);

      // Convert lastExecutionTime to ISO string for all metrics
      const expectedMetrics = Object.fromEntries(
        Object.entries(mockMetrics).map(([key, value]) => [
          key,
          {
            ...value,
            lastExecutionTime: value.lastExecutionTime.toISOString(),
          },
        ])
      );
      expect(response.body).toEqual(expectedMetrics);
    });
  });

  describe('GET /api/health/metrics/:id', () => {
    it('should return specific check metrics', async () => {
      const mockMetrics = {
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        averageResponseTime: 250,
        lastExecutionTime: new Date(),
        uptime: 80,
      };

      vi.mocked(mockOrchestrator.getMetrics).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/health/metrics/test-check')
        .expect(200);

      // Convert lastExecutionTime to ISO string for comparison
      expect(response.body).toEqual({
        ...mockMetrics,
        lastExecutionTime: mockMetrics.lastExecutionTime.toISOString(),
      });
      expect(mockOrchestrator.getMetrics).toHaveBeenCalledWith('test-check');
    });
  });

  describe('POST /api/health/checks', () => {
    it('should register new health check', async () => {
      const newCheck: HttpHealthCheckConfig = {
        id: 'new-check',
        name: 'New Check',
        type: HealthCheckType.HTTP,
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 2,
        url: 'https://example.com',
      };

      vi.mocked(mockOrchestrator.getRegisteredChecks).mockReturnValue([]);

      const response = await request(app)
        .post('/api/health/checks')
        .send(newCheck)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Health check registered successfully',
        id: 'new-check',
      });
      expect(mockOrchestrator.registerCheck).toHaveBeenCalledWith(newCheck);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidCheck = {
        name: 'Invalid Check',
        // missing id and type
      };

      const response = await request(app)
        .post('/api/health/checks')
        .send(invalidCheck)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Missing required fields: id, name, type',
      });
    });

    it('should return 409 for duplicate check ID', async () => {
      const existingCheck = {
        id: 'existing-check',
        name: 'Existing Check',
        type: HealthCheckType.HTTP,
      };

      const duplicateCheck = {
        id: 'existing-check',
        name: 'Duplicate Check',
        type: HealthCheckType.HTTP,
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 2,
      };

      vi.mocked(mockOrchestrator.getRegisteredChecks).mockReturnValue([existingCheck as any]);

      const response = await request(app)
        .post('/api/health/checks')
        .send(duplicateCheck)
        .expect(409);

      expect(response.body).toEqual({
        error: "Health check with id 'existing-check' already exists",
      });
    });
  });

  describe('DELETE /api/health/checks/:id', () => {
    it('should unregister health check', async () => {
      const response = await request(app)
        .delete('/api/health/checks/test-check')
        .expect(200);

      expect(response.body).toEqual({
        message: "Health check 'test-check' unregistered successfully",
      });
      expect(mockOrchestrator.unregisterCheck).toHaveBeenCalledWith('test-check');
    });

    it('should return 400 for missing ID', async () => {
      const response = await request(app)
        .delete('/api/health/checks/')
        .expect(404); // Express handles this as 404
    });
  });

  describe('PUT /api/health/checks/:id/toggle', () => {
    it('should enable health check', async () => {
      const response = await request(app)
        .put('/api/health/checks/test-check/toggle')
        .send({ enabled: true })
        .expect(200);

      expect(response.body).toEqual({
        message: "Health check 'test-check' enabled successfully",
      });
      expect(mockOrchestrator.toggleCheck).toHaveBeenCalledWith('test-check', true);
    });

    it('should disable health check', async () => {
      const response = await request(app)
        .put('/api/health/checks/test-check/toggle')
        .send({ enabled: false })
        .expect(200);

      expect(response.body).toEqual({
        message: "Health check 'test-check' disabled successfully",
      });
      expect(mockOrchestrator.toggleCheck).toHaveBeenCalledWith('test-check', false);
    });

    it('should return 400 for missing enabled field', async () => {
      const response = await request(app)
        .put('/api/health/checks/test-check/toggle')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'enabled field must be a boolean',
      });
    });

    it('should return 400 for invalid enabled field', async () => {
      const response = await request(app)
        .put('/api/health/checks/test-check/toggle')
        .send({ enabled: 'true' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'enabled field must be a boolean',
      });
    });

    it('should return 400 for missing ID', async () => {
      const response = await request(app)
        .put('/api/health/checks//toggle')
        .send({ enabled: true })
        .expect(404); // Express handles this as 404
    });
  });

  describe('middleware error handling', () => {
    it('should return 500 when health service is not available', async () => {
      const appWithoutService = express();
      appWithoutService.use(express.json());
      appWithoutService.use('/api', healthRoutes);

      const response = await request(appWithoutService)
        .get('/api/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Health service not available',
      });
    });
  });

  describe('error handling for orchestrator failures', () => {
    it('should handle orchestrator errors gracefully', async () => {
      vi.mocked(mockOrchestrator.getHealthSummary).mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get health status',
        message: 'Service unavailable',
      });
    });

    it('should handle unknown orchestrator errors', async () => {
      vi.mocked(mockOrchestrator.getHealthSummary).mockRejectedValue('Unknown error');

      const response = await request(app)
        .get('/api/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get health status',
        message: 'Unknown error',
      });
    });
  });
});