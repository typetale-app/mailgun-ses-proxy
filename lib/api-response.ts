/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Standard error types
 */
export const ERROR_TYPES = {
    VALIDATION_ERROR: "Validation Error",
    AUTHENTICATION_ERROR: "Authentication Error",
    AUTHORIZATION_ERROR: "Authorization Error",
    NOT_FOUND_ERROR: "Not Found",
    CONFLICT_ERROR: "Conflict",
    INTERNAL_ERROR: "Internal Server Error",
    SERVICE_ERROR: "Service Unavailable",
} as const

export interface ApiResponse {
    success: boolean
    timestamp: string
    [key: string]: any
}

/**
 * API Response structure interfaces
 */
export interface SuccessResponse extends ApiResponse{
    message: string
}

export interface ErrorResponse extends ApiResponse {
    error: string
    message: string
    details?: any
}

/**
 * Standardized API Response utility class
 * Provides consistent response formatting across the application
 */
export class ApiResponse {

    static raw<T>(data: T, status: number = HTTP_STATUS.OK): Response {
        const response: ApiResponse = {
            success: true,
            ...data,
            timestamp: new Date().toISOString(),
        }
        return Response.json(response, { status })
    }

    /**
     * Create a standardized success response
     */
    static success<T>(data: T, message: string = "Operation completed successfully", status: number = HTTP_STATUS.OK): Response {
        const response: SuccessResponse = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            message: message
        }
        return Response.json(response, { status })
    }

    /**
     * Create a standardized error response
     */
    static error(
        message: string,
        errorType: string = ERROR_TYPES.INTERNAL_ERROR,
        status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        details?: any
    ): Response {
        const response: ErrorResponse = {
            success: false,
            error: errorType,
            message,
            timestamp: new Date().toISOString(),
            ...(details && { details }),
        }

        return Response.json(response, { status })
    }

    /**
     * Bad Request (400) - Client error
     */
    static badRequest(message: string, details?: any): Response {
        return this.error(message, ERROR_TYPES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, details)
    }

    /**
     * Unauthorized (401) - Authentication required
     */
    static unauthorized(message: string = "Authentication required"): Response {
        return this.error(message, ERROR_TYPES.AUTHENTICATION_ERROR, HTTP_STATUS.UNAUTHORIZED)
    }

    /**
     * Forbidden (403) - Access denied
     */
    static forbidden(message: string = "Access denied"): Response {
        return this.error(message, ERROR_TYPES.AUTHORIZATION_ERROR, HTTP_STATUS.FORBIDDEN)
    }

    /**
     * Not Found (404) - Resource not found
     */
    static notFound(message: string = "Resource not found"): Response {
        return this.error(message, ERROR_TYPES.NOT_FOUND_ERROR, HTTP_STATUS.NOT_FOUND)
    }

    /**
     * Conflict (409) - Resource conflict
     */
    static conflict(message: string, details?: any): Response {
        return this.error(message, ERROR_TYPES.CONFLICT_ERROR, HTTP_STATUS.CONFLICT, details)
    }

    /**
     * Validation Error (400) - Validation error
     */
    static validationError(message: string, details?: any): Response {
        return Response.json(
            {
                success: false,
                error: ERROR_TYPES.VALIDATION_ERROR,
                message,
                timestamp: new Date().toISOString(),
                ...(details && { details }),
            },
            { status: HTTP_STATUS.BAD_REQUEST }
        )
    }

    /**
     * Internal Server Error (500) - Server error
     */
    static internalError(message: string = "An internal server error occurred"): Response {
        return this.error(message, ERROR_TYPES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    /**
     * Service Unavailable (503) - Service temporarily unavailable
     */
    static serviceUnavailable(message: string = "Service temporarily unavailable"): Response {
        return this.error(message, ERROR_TYPES.SERVICE_ERROR, HTTP_STATUS.SERVICE_UNAVAILABLE)
    }

    /**
     * Created (201) - Resource created successfully
     */
    static created<T>(data: T, message: string = "Resource created successfully"): Response {
        return this.success(data, message, HTTP_STATUS.CREATED)
    }

    /**
     * No Content (204) - Operation successful with no content
     */
    static noContent(): Response {
        return new Response(null, { status: 204 })
    }
}
