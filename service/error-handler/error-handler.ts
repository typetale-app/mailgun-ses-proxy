/**
 * Error Handler Service
 * Provides standardized error handling and response creation
 */

export interface ErrorResponse {
    error: string
    message: string
    status: number
    context?: string
}

export class ErrorHandler {
    /**
     * Handle API errors and convert them to standardized error objects
     */
    static handleApiError(error: any, context?: string): ErrorResponse {
        if (error instanceof Error) {
            return {
                error: error.name || 'Error',
                message: error.message,
                status: 500,
                context,
            }
        }

        // Handle non-Error exceptions
        return {
            error: 'Unknown Error',
            message: 'An unexpected error occurred',
            status: 500,
            context,
        }
    }

    /**
     * Create a Response object from an error response
     */
    static createResponse(errorResponse: ErrorResponse): Response {
        return Response.json(
            {
                error: errorResponse.error,
                message: errorResponse.message,
            },
            { status: errorResponse.status }
        )
    }
}