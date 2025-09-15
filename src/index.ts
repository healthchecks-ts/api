import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRoutes, { HealthRequest } from './routes/health';
import { HealthCheckOrchestrator } from './services/health-check-orchestrator';
import { Logger } from './services/logger';
import { HealthCheckType } from './types';

// Initialize services
const logger = new Logger();
const healthService = new HealthCheckOrchestrator();

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Inject health service into requests
app.use((req: HealthRequest, res, next) => {
  req.healthService = healthService;
  next();
});

// Routes
app.use('/api', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Health Check API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      healthDetailed: '/api/health/detailed',
      checks: '/api/health/checks',
      metrics: '/api/health/metrics',
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Sample health checks setup
function setupSampleHealthChecks(): void {
  // HTTP health check example
  healthService.registerCheck({
    id: 'google-http',
    name: 'Google HTTP Check',
    type: HealthCheckType.HTTP,
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retries: 2,
    metadata: {
      url: 'https://www.google.com',
      method: 'GET',
      expectedStatusCodes: [200],
    },
  });

  // System health check example
  healthService.registerCheck({
    id: 'system-resources',
    name: 'System Resources Check',
    type: HealthCheckType.SYSTEM,
    enabled: true,
    interval: 60000,
    timeout: 10000,
    retries: 1,
    metadata: {
      checks: [
        { type: 'memory', threshold: 80 },
        { type: 'cpu', threshold: 90 },
      ],
    },
  });

  logger.info('Sample health checks registered');
}

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Health check API started`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
  });

  // Setup sample health checks
  setupSampleHealthChecks();

  // Log initial health status
  setTimeout(async () => {
    try {
      const summary = await healthService.getHealthSummary();
      logger.logHealthSummary(summary);
    } catch (error) {
      logger.error('Failed to get initial health summary', error as Error);
    }
  }, 2000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  healthService.dispose();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  healthService.dispose();
  process.exit(0);
});

export default app;