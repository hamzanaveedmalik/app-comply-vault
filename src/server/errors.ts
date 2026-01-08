/**
 * Centralized error handling utilities
 * Provides user-friendly error messages and actionable guidance
 */

export interface UserFriendlyError {
  message: string;
  action?: string;
  code?: string;
  statusCode: number;
}

export class AppError extends Error {
  constructor(
    public userMessage: string,
    public statusCode: number = 500,
    public action?: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(userMessage);
    this.name = "AppError";
  }

  toJSON(): UserFriendlyError {
    return {
      message: this.userMessage,
      action: this.action,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Convert various error types to user-friendly messages
 */
export function handleError(error: unknown): UserFriendlyError {
  // AppError - already user-friendly
  if (error instanceof AppError) {
    return error.toJSON();
  }

  // Zod validation errors
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    const firstIssue = zodError.issues[0];
    const field = firstIssue?.path.join(".") || "field";
    return {
      message: `Invalid ${field}: ${firstIssue?.message || "Please check your input"}`,
      action: "Please review the form and try again",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    };
  }

  // Database errors
  if (error && typeof error === "object" && "code" in error) {
    const dbError = error as { code: string; message?: string };
    
    if (dbError.code === "P2002") {
      // Unique constraint violation
      return {
        message: "This record already exists. Please use a different value.",
        action: "Try again with different information",
        code: "DUPLICATE_RECORD",
        statusCode: 409,
      };
    }
    
    if (dbError.code === "P2025") {
      // Record not found
      return {
        message: "The requested record was not found.",
        action: "Please check the ID and try again",
        code: "NOT_FOUND",
        statusCode: 404,
      };
    }
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      message: "Network error. Please check your internet connection.",
      action: "Try again in a moment",
      code: "NETWORK_ERROR",
      statusCode: 503,
    };
  }

  // File upload errors
  if (error && typeof error === "object" && "message" in error) {
    const err = error as { message: string };
    if (err.message.includes("file") || err.message.includes("upload")) {
      return {
        message: "File upload failed. The file may be too large or in an unsupported format.",
        action: "Please try uploading again with a smaller file or different format",
        code: "UPLOAD_ERROR",
        statusCode: 400,
      };
    }
  }

  // Authentication errors
  if (error && typeof error === "object" && "message" in error) {
    const err = error as { message: string };
    if (err.message.includes("auth") || err.message.includes("unauthorized")) {
      return {
        message: "You need to sign in to access this resource.",
        action: "Please sign in and try again",
        code: "UNAUTHORIZED",
        statusCode: 401,
      };
    }
  }

  // Permission errors
  if (error && typeof error === "object" && "message" in error) {
    const err = error as { message: string };
    if (err.message.includes("forbidden") || err.message.includes("permission")) {
      return {
        message: "You don't have permission to perform this action.",
        action: "Contact your workspace owner if you need access",
        code: "FORBIDDEN",
        statusCode: 403,
      };
    }
  }

  // Default: Generic error (don't expose system details)
  return {
    message: "Something went wrong. Please try again.",
    action: "If the problem persists, contact support@complyvault.com",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  };
}

/**
 * Create user-friendly error responses for API routes
 */
export function createErrorResponse(error: unknown, logContext?: Record<string, unknown>) {
  const userError = handleError(error);
  
  // Log full error details server-side (but don't expose to client)
  if (error instanceof Error) {
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...logContext,
    });
  } else {
    console.error("Unknown error:", error, logContext);
  }

  return Response.json(
    {
      error: userError.message,
      action: userError.action,
      code: userError.code,
    },
    { status: userError.statusCode }
  );
}

/**
 * Common error messages for specific scenarios
 */
export const ErrorMessages = {
  UPLOAD_FAILED: {
    message: "File upload failed. Please try again.",
    action: "Check your internet connection and file size (max 500MB), then try uploading again",
  },
  PROCESSING_FAILED: {
    message: "Meeting processing failed. The file may be corrupted or in an unsupported format.",
    action: "Try uploading the file again or contact support if the problem persists",
  },
  TRANSCRIPTION_FAILED: {
    message: "Transcription service is temporarily unavailable.",
    action: "Please try again in a few minutes",
  },
  EXTRACTION_FAILED: {
    message: "Data extraction failed. The transcript may be too short or unclear.",
    action: "Try reprocessing the meeting or contact support",
  },
  NETWORK_ERROR: {
    message: "Network error. Please check your connection.",
    action: "Try again in a moment",
  },
  FILE_TOO_LARGE: {
    message: "File is too large. Maximum size is 500MB.",
    action: "Please compress the file or use a smaller recording",
  },
  INVALID_FILE_FORMAT: {
    message: "File format not supported. Please use MP3, MP4, WAV, or M4A.",
    action: "Convert your file to a supported format and try again",
  },
  MEETING_NOT_FOUND: {
    message: "Meeting not found.",
    action: "Please check the meeting ID and try again",
  },
  WORKSPACE_NOT_FOUND: {
    message: "Workspace not found or access denied.",
    action: "Please check your workspace access and try again",
  },
} as const;

