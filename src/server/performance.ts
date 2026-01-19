import { NextRequest, NextResponse } from "next/server";
import { metrics } from "~/lib/metrics";

export async function withPerformanceTracking(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = performance.now();
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Record request
  metrics.incrementCounter("http_requests_total", 1, {
    method: request.method,
    path,
  });
  
  try {
    const response = await handler(request);
    const duration = performance.now() - startTime;
    
    // Record response time
    metrics.observeHistogram("http_request_duration_seconds", duration / 1000, {
      method: request.method,
      path,
      status: response.status.toString(),
    });
    
    // Record status codes
    metrics.incrementCounter("http_responses_total", 1, {
      method: request.method,
      path,
      status: response.status.toString(),
    });
    
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Record errors
    metrics.incrementCounter("http_errors_total", 1, {
      method: request.method,
      path,
      error: error instanceof Error ? error.name : "Unknown",
    });
    
    // Record error response time
    metrics.observeHistogram("http_request_duration_seconds", duration / 1000, {
      method: request.method,
      path,
      status: "500",
    });
    
    throw error;
  }
}

// Function to wrap API route handlers with performance tracking
export function withPerformance<T extends (...args: any[]) => Promise<any>>(
  name: string,
  handler: T
): T {
  return (async (...args) => {
    const startTime = performance.now();
    
    try {
      const result = await handler(...args);
      const duration = performance.now() - startTime;
      
      // Record function duration
      metrics.observeHistogram("function_duration_seconds", duration / 1000, {
        name,
        success: "true",
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Record function errors
      metrics.incrementCounter("function_errors_total", 1, {
        name,
        error: error instanceof Error ? error.name : "Unknown",
      });
      
      // Record error duration
      metrics.observeHistogram("function_duration_seconds", duration / 1000, {
        name,
        success: "false",
      });
      
      throw error;
    }
  }) as T;
}