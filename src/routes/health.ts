import express, { Request, Response, NextFunction } from 'express';
import { HealthCheckOrchestrator } from '../services/health-check-orchestrator';
import { HealthCheckConfig, HealthStatus } from '../types';

const router = express.Router();

// Middleware to inject health service
interface HealthRequest extends Request {
  healthService?: HealthCheckOrchestrator;
}

// Middleware to ensure health service is available
const requireHealthService = (req: HealthRequest, res: Response, next: NextFunction): void => {
  if (!req.healthService) {
    res.status(500).json({ error: 'Health service not available' });
    return;
  }
  next();
};

// GET /health - Quick health status endpoint
router.get('/health', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const summary = await req.healthService!.getHealthSummary();
    
    // Return appropriate HTTP status based on health
    let httpStatus = 200;
    if (summary.status === HealthStatus.UNHEALTHY) {
      httpStatus = 503; // Service Unavailable
    } else if (summary.status === HealthStatus.DEGRADED) {
      httpStatus = 206; // Partial Content
    }

    res.status(httpStatus).json({
      status: summary.status,
      timestamp: summary.timestamp,
      checks: {
        total: summary.totalChecks,
        healthy: summary.healthyChecks,
        unhealthy: summary.unhealthyChecks,
        degraded: summary.degradedChecks,
        unknown: summary.unknownChecks,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get health status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health/detailed - Detailed health status with all check results
router.get('/health/detailed', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const summary = await req.healthService!.getHealthSummary();
    
    let httpStatus = 200;
    if (summary.status === HealthStatus.UNHEALTHY) {
      httpStatus = 503;
    } else if (summary.status === HealthStatus.DEGRADED) {
      httpStatus = 206;
    }

    res.status(httpStatus).json(summary);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get detailed health status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health/checks - List all registered health checks
router.get('/health/checks', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const checks = req.healthService!.getRegisteredChecks();
    res.json({
      total: checks.length,
      checks: checks.map(check => ({
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
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get health checks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health/checks/:id - Get specific health check status
router.get('/health/checks/:id', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Health check ID is required' });
      return;
    }
    const result = await req.healthService!.getCheckStatus(id);
    
    if (!result) {
      res.status(404).json({ error: `Health check '${id}' not found or no results available` });
      return;
    }

    let httpStatus = 200;
    if (result.status === HealthStatus.UNHEALTHY) {
      httpStatus = 503;
    } else if (result.status === HealthStatus.DEGRADED) {
      httpStatus = 206;
    }

    res.status(httpStatus).json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get health check status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /health/checks/:id/execute - Execute a specific health check manually
router.post('/health/checks/:id/execute', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Health check ID is required' });
      return;
    }
    const result = await req.healthService!.executeCheck(id);
    
    let httpStatus = 200;
    if (result.status === HealthStatus.UNHEALTHY) {
      httpStatus = 503;
    } else if (result.status === HealthStatus.DEGRADED) {
      httpStatus = 206;
    }

    res.status(httpStatus).json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to execute health check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health/metrics - Get metrics for all health checks
router.get('/health/metrics', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const metrics = await req.healthService!.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get health metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health/metrics/:id - Get metrics for a specific health check
router.get('/health/metrics/:id', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const metrics = await req.healthService!.getMetrics(id);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get health check metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /health/checks - Register a new health check
router.post('/health/checks', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const config: HealthCheckConfig = req.body;
    
    // Basic validation
    if (!config.id || !config.name || !config.type) {
      res.status(400).json({ error: 'Missing required fields: id, name, type' });
      return;
    }

    // Check if check already exists
    const existingChecks = req.healthService!.getRegisteredChecks();
    if (existingChecks.some(check => check.id === config.id)) {
      res.status(409).json({ error: `Health check with id '${config.id}' already exists` });
      return;
    }

    req.healthService!.registerCheck(config);
    res.status(201).json({ message: 'Health check registered successfully', id: config.id });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to register health check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /health/checks/:id - Unregister a health check
router.delete('/health/checks/:id', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Health check ID is required' });
      return;
    }
    req.healthService!.unregisterCheck(id);
    res.json({ message: `Health check '${id}' unregistered successfully` });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to unregister health check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /health/checks/:id/toggle - Enable/disable a health check
router.put('/health/checks/:id/toggle', requireHealthService, async (req: HealthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (!id) {
      res.status(400).json({ error: 'Health check ID is required' });
      return;
    }
    
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled field must be a boolean' });
      return;
    }

    req.healthService!.toggleCheck(id, enabled);
    res.json({ message: `Health check '${id}' ${enabled ? 'enabled' : 'disabled'} successfully` });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to toggle health check',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
export { HealthRequest };