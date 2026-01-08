/**
 * API route error handler wrapper
 * Wraps API route handlers to provide consistent error handling
 */

import { createErrorResponse } from "~/server/errors";
import type { NextRequest } from "next/server";

export function withErrorHandler<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return createErrorResponse(error, {
        path: request.url,
        method: request.method,
      });
    }
  };
}

