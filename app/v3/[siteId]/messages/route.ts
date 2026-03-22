import { ApiResponse } from "@/lib/api-response"
import { formDataToObject } from "@/lib/core/common"
import logger from "@/lib/core/logger"
import { addNewsletterToQueue } from "@/service/newsletter-service"
import { MailgunMessage } from "@/types/mailgun"

const log = logger.child({ path: "app:v3:messages" })
type pathParam = { params: Promise<{ siteId: string }> }

/**
 * Send newsletter messages via Mailgun-compatible API
 *
 * @route POST /v3/[siteId]/messages
 * @description Queues newsletter emails for processing through Amazon SES
 * @param siteId - Site identifier for the newsletter batch
 * @body {FormData} - Mailgun-compatible form data with email content
 * @returns {Object} - Response with batch ID for tracking
 */
export async function POST(req: Request, { params }: pathParam) {
    const { siteId } = await params
    if (!siteId) return ApiResponse.badRequest("siteId is required")
    try {
        const message = await validateRequest(req)
        const { messageId, batchId } = await addNewsletterToQueue(message, siteId)
        log.info({ messageId, batchId }, "message queued to newsletter SQS")
        return ApiResponse.raw({ id: batchId, message: "message queued to SQS" }, 200)
    } catch (e) {
        log.error(e, "Error when queuing message to newsletter SQS")
        const errorMessage = e instanceof Error ? e.message : "an error occurred"
        return ApiResponse.badRequest(errorMessage)
    }
}

async function validateRequest(req: Request): Promise<MailgunMessage> {
    const data = formDataToObject(await req.formData()) as unknown as MailgunMessage
    // fixing Ghost `email_previews` endpoint call
    data["v:email-id"] = (data["v:email-id"] as string) || "no-batch-id-provided"
    return data
}