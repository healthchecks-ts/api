# Health Checks API

A comprehensive API health checker built with TypeScript and Express.js that monitors the health of HTTP endpoints, databases, and system resources.

## Features

- 🌐 **HTTP Health Checks**: Monitor REST APIs, websites, and web services
- 🗄️ **Database Health Checks**: Support for PostgreSQL, MySQL, MongoDB, and Redis
- 🖥️ **System Health Checks**: Monitor CPU, memory, and disk usage
- 📊 **Metrics Collection**: Track uptime, response times, and success rates
- 🔄 **Periodic Monitoring**: Automated health checks with configurable intervals
- 🚨 **Retry Logic**: Configurable retry attempts with backoff
- 📝 **Structured Logging**: Winston-based logging with health check events
- 🛡️ **Security**: Helmet.js security headers and CORS support
- ⚙️ **Configuration**: JSON file and environment variable configuration

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Build the project**:

   ```bash
   npm run build
   ```

3. **Start the server**:

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

4. **Access the API**:
   - Health status: `GET http://localhost:3000/api/health`
   - Detailed health: `GET http://localhost:3000/api/health/detailed`
   - API documentation: `GET http://localhost:3000/`

## API Endpoints

### Health Status

- `GET /api/health` - Quick health status overview
- `GET /api/health/detailed` - Detailed health status with all check results

### Health Check Management

- `GET /api/health/checks` - List all registered health checks
- `GET /api/health/checks/:id` - Get specific health check status
- `POST /api/health/checks/:id/execute` - Execute a health check manually
- `POST /api/health/checks` - Register a new health check
- `DELETE /api/health/checks/:id` - Unregister a health check
- `PUT /api/health/checks/:id/toggle` - Enable/disable a health check

### Metrics

- `GET /api/health/metrics` - Get metrics for all health checks
- `GET /api/health/metrics/:id` - Get metrics for a specific health check

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Health check defaults
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000
MAX_RETRIES=3

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Configuration directory
HEALTH_CHECKS_CONFIG_DIR=./config
```

### Environment-based Health Checks

You can define health checks using environment variables:

```bash
# HTTP check example
HEALTH_CHECK_API_URL=https://api.example.com/health
HEALTH_CHECK_API_NAME="API Service"
HEALTH_CHECK_API_METHOD=GET
HEALTH_CHECK_API_TIMEOUT=5000
HEALTH_CHECK_API_INTERVAL=30000
```

### Configuration Files

Health checks can be defined in JSON files in the `config/` directory:

#### HTTP Health Check Example

```json
{
  "id": "api-service",
  "name": "API Service Health",
  "type": "http",
  "enabled": true,
  "interval": 30000,
  "timeout": 5000,
  "retries": 3,
  "metadata": {
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatusCodes": [200],
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

#### Database Health Check Example

```json
{
  "id": "postgres-main",
  "name": "PostgreSQL Main Database",
  "type": "database",
  "enabled": true,
  "interval": 60000,
  "timeout": 8000,
  "retries": 2,
  "metadata": {
    "connectionString": "postgresql://user:password@localhost:5432/maindb",
    "databaseType": "postgresql",
    "query": "SELECT 1 as health_check"
  }
}
```

#### System Health Check Example

```json
{
  "id": "system-performance",
  "name": "System Performance Check",
  "type": "system",
  "enabled": true,
  "interval": 120000,
  "timeout": 15000,
  "metadata": {
    "checks": [
      { "type": "memory", "threshold": 85 },
      { "type": "cpu", "threshold": 90 },
      { "type": "disk", "threshold": 90, "path": "/" }
    ]
  }
}
```

## Health Check Types

### HTTP Health Checks

- Monitor REST APIs and web endpoints
- Support for custom headers and authentication
- Configurable expected status codes and response body validation
- Follow redirects option

### Database Health Checks

- **PostgreSQL**: Connection and query execution
- **MySQL**: Connection and query execution
- **MongoDB**: Connection and ping operations
- **Redis**: Connection and ping operations

### System Health Checks

- **Memory**: Monitor RAM usage percentage
- **CPU**: Monitor CPU load average
- **Disk**: Monitor disk usage by path

## Health Status Values

- `healthy` - Check passed successfully
- `degraded` - Check passed but performance is poor (slow response)
- `unhealthy` - Check failed
- `unknown` - Check status could not be determined

## HTTP Response Codes

- `200` - All checks healthy
- `206` - Some checks degraded (partial content)
- `503` - One or more checks unhealthy (service unavailable)
- `500` - Internal server error

## Development

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── checkers/          # Health check implementations
│   ├── http.ts       # HTTP endpoint checker
│   ├── database.ts   # Database connectivity checker
│   └── system.ts     # System resource checker
├── routes/           # Express routes
│   └── health.ts     # Health check API routes
├── services/         # Core services
│   ├── health-check-orchestrator.ts  # Main orchestrator
│   └── logger.ts     # Logging service
├── types.ts          # TypeScript type definitions
└── index.ts          # Application entry point
```

## License

MIT License - see LICENSE file for details.
