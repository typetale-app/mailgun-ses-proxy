import { ApiResponse } from "@/lib/api-response"
import logger from "@/lib/core/logger"
import { transactionalEmailService } from "@/service/transaction-email-service"
import { ValidationService, type EmailPayload } from "@/service/validation-service"
import { NextRequest } from "next/server"

const log = logger.child({ module: "api:v1:send" })

async function validateBody(req: NextRequest) {
    let body: any
    try {
        body = await req.json()
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error("Invalid JSON in request body")
        throw error
    }
    if (!body || typeof body !== "object") {
        throw new Error("Request body must be an object")
    }
    return body
}

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

/**
 * Send transactional/system emails via SES.
 * Provides normalization, validation, and standardized error responses.
 */
export async function POST(req: NextRequest): Promise<Response> {
    try {
        const body = await validateBody(req)
        const payload = preparePayload(body)
        const validation = ValidationService.validateEmailPayload(payload)
        if (validation && validation.data) {
            const { messageId } = await transactionalEmailService.sendSystemMail(validation.data)
            const { to, subject } = validation.data
            log.info({ messageId, to, subject }, "System email sent")
            return ApiResponse.success({ messageId, status: "sent", recipients: to.length })
        } else {
            log.error({ errors: validation.errors }, "Email validation failed")
            return ApiResponse.validationError(`Validation failed: ${validation.errors.join("; ")}`)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred"
        log.error({ error: message }, "Failed to process system email")
        return ApiResponse.internalError(message)
    }
}
