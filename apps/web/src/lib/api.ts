import { getAuthHeader } from "./auth";
import type { PaginationParams, PaginatedResponse } from "@contracts/common";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async getHeaders(): Promise<HeadersInit> {
    const authHeader = await getAuthHeader();
    const headers: HeadersInit = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    return headers;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, signal, headers: customHeaders, ...fetchOptions } = options;

    const headers = await this.getHeaders();
    const mergedHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
      ...(customHeaders as Record<string, string> | undefined),
    };
    if (fetchOptions.body !== undefined && !mergedHeaders["Content-Type"]) {
      mergedHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(this.buildUrl(path, params), {
      ...fetchOptions,
      headers: mergedHeaders,
      signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      // The API wraps every failure as { success: false, error: { code, message, details } }.
      // Also tolerate a flat { code, message } shape and non-JSON bodies.
      const parsed = isJson && body && typeof body === "object" ? (body as Record<string, any>) : null;
      const envelope =
        parsed && typeof parsed.error === "object" && parsed.error !== null ? parsed.error : parsed;
      const error: ApiError = {
        code: envelope?.code ?? "HTTP_ERROR",
        message: envelope?.message ?? `HTTP ${response.status}`,
        details: envelope?.details,
      };

      throw new ApiErrorResponse(response.status, error.code, error.message, error.details);
    }

    return body as T;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export class ApiErrorResponse extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiErrorResponse";
  }
}

export function isApiError(error: unknown): error is ApiErrorResponse {
  return error instanceof ApiErrorResponse;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
}

export function getErrorCode(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.code;
  }
  return undefined;
}

export const api = new ApiClient(API_BASE_URL);

export type { RequestOptions, PaginationParams, PaginatedResponse };
