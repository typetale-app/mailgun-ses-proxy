import { ApiResponse } from "@/lib/api-response"
import logger from "@/lib/core/logger"
import { sendSystemMail } from "@/service/transaction-email-service"
import { ValidationService, type EmailPayload } from "@/service/validation-service/validation"
import { NextRequest } from "next/server"

const log = logger.child({ module: "api:v1:send" })

/**
 * Send transactional/system emails via SES.
 * Provides normalization, validation, and standardized error responses.
 */
export async function POST(req: NextRequest): Promise<Response> {
    const requestId = crypto.randomUUID()
    const requestLog = log.child({ requestId })

    try {
        // Parse body with precise error handling for tests
        let body: any
        try {
            body = await req.json()
        } catch (error) {
            if (error instanceof SyntaxError) return ApiResponse.badRequest("Invalid JSON in request body")
            throw error // Propagate to main catch (500)
        }

        if (!body || typeof body !== "object") {
            return ApiResponse.badRequest("Request body must be an object")
        }

        // Prepare and normalize payload
        const payload = preparePayload(body)
        
        // Validate payload structure
        const validation = ValidationService.validateEmailPayload(payload)
        if (!validation?.data) {
            requestLog.warn({ errors: validation.errors }, "Email validation failed")
            return ApiResponse.validationError(`Validation failed: ${validation.errors.join("; ")}`)
        }

        // Execute send
        const { messageId } = await sendSystemMail(validation.data)
        
        requestLog.info({ 
            messageId, 
            to: validation.data.to, 
            subject: validation.data.subject 
        }, "System email sent")

        return ApiResponse.success({
            messageId,
            status: "sent",
            recipients: validation.data.to.length,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred"
        requestLog.error({ error: message }, "Failed to process system email")
        
        // Generic errors and config errors (like missing 'from') return 500
        return ApiResponse.internalError(message)
    }
}


/**
 * Normalizes input body into a valid EmailPayload shape
 */
function preparePayload(body: any): Partial<EmailPayload> {
    const from = body.from || process.env.SYSTEM_FROM_ADDRESS
    if (!from) throw new Error("No 'from' address provided and SYSTEM_FROM_ADDRESS not configured")

    return {
        ...body,
        from,
        replyTo: body.replyTo || from,
        to: typeof body.to === "string" ? [body.to] : body.to
    }
}

