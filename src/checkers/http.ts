import axios, { AxiosResponse, AxiosError } from 'axios';
import {
  HealthChecker,
  HealthCheckConfig,
  HealthCheckResult,
  HealthCheckType,
  HealthStatus,
  HttpHealthCheckConfig,
  HealthCheckOptions,
} from '../types';

export class HttpHealthChecker implements HealthChecker {
  getType(): HealthCheckType {
    return HealthCheckType.HTTP;
  }

  async check(
    config: HealthCheckConfig,
    options?: HealthCheckOptions
  ): Promise<HealthCheckResult> {
    const httpConfig = config as HttpHealthCheckConfig;
    const startTime = Date.now();
    const timestamp = new Date();
    const timeout = options?.timeout || config.timeout || 5000;
    const maxRetries = options?.retries || config.retries || 0;
    const retryDelay = options?.retryDelay || 1000;

    let lastError: string | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performHttpCheck(httpConfig, timeout);
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
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            url: httpConfig.url,
            method: httpConfig.method || 'GET',
          },
          retryCount: attempt,
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
        url: httpConfig.url,
        method: httpConfig.method || 'GET',
      },
      retryCount,
    };
  }

  private async performHttpCheck(
    config: HttpHealthCheckConfig,
    timeout: number
  ): Promise<{ status: HealthStatus; message: string; statusCode: number; responseTime: number }> {
    const startTime = Date.now();

    try {
      const response: AxiosResponse = await axios({
        method: config.method || 'GET',
        url: config.url,
        ...(config.headers && { headers: config.headers }),
        timeout,
        maxRedirects: config.followRedirects === false ? 0 : 5,
        validateStatus: () => true, // Don't throw on any status code
      });

      const responseTime = Date.now() - startTime;
      const statusCode = response.status;

      // Check expected status codes
      const expectedCodes = config.expectedStatusCodes || [200];
      if (!expectedCodes.includes(statusCode)) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Unexpected status code: ${statusCode}`,
          statusCode,
          responseTime,
        };
      }

      // Check expected body content if specified
      if (config.expectedBody) {
        const bodyMatches = this.checkBodyContent(response.data, config.expectedBody);
        if (!bodyMatches) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: 'Response body does not match expected content',
            statusCode,
            responseTime,
          };
        }
      }

      // Determine health status based on response time and status
      let status = HealthStatus.HEALTHY;
      if (responseTime > timeout * 0.8) {
        status = HealthStatus.DEGRADED;
      }

      return {
        status,
        message: `HTTP check successful (${statusCode})`,
        statusCode,
        responseTime,
      };
    } catch (error) {
      throw error;
    }
  }

  private checkBodyContent(responseBody: unknown, expectedBody: string | RegExp): boolean {
    const bodyString = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);

    if (typeof expectedBody === 'string') {
      return bodyString.includes(expectedBody);
    } else if (expectedBody instanceof RegExp) {
      return expectedBody.test(bodyString);
    }

    return false;
  }

  private extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNABORTED') {
        return 'Request timeout';
      }
      if (axiosError.code === 'ECONNREFUSED') {
        return 'Connection refused';
      }
      if (axiosError.code === 'ENOTFOUND') {
        return 'Host not found';
      }
      if (axiosError.response && axiosError.response.status && axiosError.response.statusText) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      }
      return axiosError.message || 'Unknown axios error';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error occurred';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}