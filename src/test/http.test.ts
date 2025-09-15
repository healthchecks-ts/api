import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import { HttpHealthChecker } from '../checkers/http';
import { HealthCheckType, HealthStatus, HttpHealthCheckConfig } from '../types';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock axios.isAxiosError
(mockedAxios.isAxiosError as any) = vi.fn();

describe('HttpHealthChecker', () => {
  let checker: HttpHealthChecker;
  let mockConfig: HttpHealthCheckConfig;

  beforeEach(() => {
    checker = new HttpHealthChecker();
    mockConfig = {
      id: 'test-http',
      name: 'Test HTTP Check',
      type: HealthCheckType.HTTP,
      enabled: true,
      interval: 30000,
      timeout: 5000,
      retries: 2,
      url: 'https://example.com/health',
      method: 'GET',
      expectedStatusCodes: [200],
    };
    vi.clearAllMocks();
  });

  describe('getType', () => {
    it('should return HTTP type', () => {
      expect(checker.getType()).toBe(HealthCheckType.HTTP);
    });
  });

  describe('check', () => {
    it('should return healthy status for successful HTTP request', async () => {
      const mockResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.id).toBe('test-http');
      expect(result.name).toBe('Test HTTP Check');
      expect(result.type).toBe(HealthCheckType.HTTP);
      expect(result.message).toContain('HTTP check successful');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata).toEqual({
        url: 'https://example.com/health',
        method: 'GET',
        statusCode: 200,
        responseTime: expect.any(Number),
      });
    });

    it('should handle request timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded') as AxiosError;
      timeoutError.code = 'ECONNABORTED';
      (mockedAxios.isAxiosError as any).mockReturnValue(true);
      mockedAxios.mockRejectedValueOnce(timeoutError);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Request timeout');
    });

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED') as AxiosError;
      connectionError.code = 'ECONNREFUSED';
      (mockedAxios.isAxiosError as any).mockReturnValue(true);
      mockedAxios.mockRejectedValueOnce(connectionError);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle host not found errors', async () => {
      const hostError = new Error('getaddrinfo ENOTFOUND') as AxiosError;
      hostError.code = 'ENOTFOUND';
      (mockedAxios.isAxiosError as any).mockReturnValue(true);
      mockedAxios.mockRejectedValueOnce(hostError);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Host not found');
    });

    it('should handle HTTP response errors', async () => {
      const responseError = new Error('Request failed with status code 500') as AxiosError;
      responseError.response = {
        status: 500,
        statusText: 'Internal Server Error',
      } as any;
      (mockedAxios.isAxiosError as any).mockReturnValue(true);
      mockedAxios.mockRejectedValueOnce(responseError);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should use custom options for timeout and retries', async () => {
      const customOptions = {
        timeout: 2000,
        retries: 1,
      };

      const timeoutError = new Error('timeout') as AxiosError;
      timeoutError.code = 'ECONNABORTED';
      (mockedAxios.isAxiosError as any).mockReturnValue(true);
      mockedAxios.mockRejectedValue(timeoutError);

      const result = await checker.check(mockConfig, customOptions);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.retryCount).toBe(1);
      // Note: We can't reliably test exact call count due to mocking complexities
    });

    it('should handle unknown error types', async () => {
      const unknownError = 'String error';
      (mockedAxios.isAxiosError as any).mockReturnValue(false);
      mockedAxios.mockRejectedValueOnce(unknownError);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toBe('Unknown error occurred');
    });

    it('should succeed after retries', async () => {
      const mockResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      const networkError = new Error('Network Error') as AxiosError;
      (mockedAxios.isAxiosError as any).mockReturnValue(true);

      mockedAxios
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

      const result = await checker.check(mockConfig);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.retryCount).toBe(2);
    });
  });
});