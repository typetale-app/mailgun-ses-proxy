import { SESv2Client } from "@aws-sdk/client-sesv2"
import { SQSClient } from "@aws-sdk/client-sqs"

export const QUEUE_URL = {
    NEWSLETTER: process.env.NEWSLETTER_QUEUE,
    NEWSLETTER_NOTIFICATION: process.env.NEWSLETTER_NOTIFICATION_QUEUE,
    SYSTEM_NOTIFICATION: process.env.TRANSACTIONAL_NOTIFICATION_QUEUE,
}

// ---------------------------------------------------------------------------
// AwsService — lazy-initialised singleton AWS clients
// ---------------------------------------------------------------------------

export class AwsService {
    private sesNewsletter: SESv2Client | null = null
    private sesSystem: SESv2Client | null = null
    private sqs: SQSClient | null = null

    constructor() {
        // check env vars before allowing object creation
        if (!process.env.SES_REGION) throw new Error("env variable SES_REGION not found")
        if (!process.env.SQS_REGION) throw new Error("env variable SQS_REGION not found")
    }

    private getAnySESRegion() {
        const regions = process.env.SES_REGION?.split(",").map(s => s.trim()) || []
        if (regions.length === 0) throw new Error("env variable SES_REGION is not defined")
        return regions[Math.floor(Math.random() * regions.length)]
    }

    /** SES client for newsletter sending. Region is randomly chosen from SES_REGION (CSV). */
    sesNewsletterClient(): SESv2Client {
        if (this.sesNewsletter) return this.sesNewsletter
        this.sesNewsletter = new SESv2Client({ region: this.getAnySESRegion() })
        return this.sesNewsletter
    }

    /** SES client for transactional/system emails. Uses SES_TRANSACTIONAL_REGION. */
    sesSystemClient(): SESv2Client {
        if (this.sesSystem) return this.sesSystem
        this.sesSystem = new SESv2Client({ region: this.getAnySESRegion() })
        return this.sesSystem
    }

    /** SQS client. Uses SQS_REGION. */
    sqsClient(): SQSClient {
        if (this.sqs) return this.sqs
        this.sqs = new SQSClient({ region: process.env.SQS_REGION })
        return this.sqs
    }
}

export const awsService = new AwsService()

