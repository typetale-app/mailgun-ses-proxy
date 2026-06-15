export interface ErrorResponse {
    error: string
    message: string
    status: number
    context?: string
}

export class ErrorHandler {

    static handleApiError(error: any, context?: string): ErrorResponse {
        if (error instanceof Error) {
            return {
                error: error.name || 'Error',
                message: error.message,
                status: 500,
                context,
            }
        }
        return {
            error: 'Unknown Error',
            message: 'An unexpected error occurred',
            status: 500,
            context,
        }
    }

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