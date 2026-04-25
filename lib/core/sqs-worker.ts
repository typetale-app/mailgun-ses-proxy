import { 
    Message, 
    ReceiveMessageCommand, 
    DeleteMessageCommand, 
    MessageSystemAttributeName,
    QueueAttributeName
} from "@aws-sdk/client-sqs"
import { sqsClient } from "@/service/aws/awsHelper"
import logger from "./logger"

const log = logger.child({ module: "sqs-worker" })

interface WorkerConfig {
    name: string
    queueUrl: string
    visibilityTimeout?: number
    waitTimeSeconds?: number
    handler: (message: Message) => Promise<void>
}

/**
 * Starts a long-polling SQS worker.
 * Handles polling, error logging, and message deletion upon successful processing.
 */
export async function startWorker(config: WorkerConfig) {
    const { 
        name, 
        queueUrl, 
        visibilityTimeout = 30, 
        waitTimeSeconds = 20, 
        handler 
    } = config

    if (!queueUrl) {
        log.error({ name }, "Queue URL is missing, worker cannot start")
        return
    }

    log.info({ name, queueUrl }, `Starting SQS worker: ${name}`)

    const client = sqsClient()
    const input = {
        QueueUrl: queueUrl,
        AttributeNames: ["All"] as QueueAttributeName[],
        MessageAttributeNames: ["All"],
        MessageSystemAttributeNames: [
            MessageSystemAttributeName.SentTimestamp,
            MessageSystemAttributeName.ApproximateReceiveCount
        ],
        VisibilityTimeout: visibilityTimeout,
        WaitTimeSeconds: waitTimeSeconds,
    }

    const receiveCommand = new ReceiveMessageCommand(input)

    while (true) {
        try {
            const { Messages } = await client.send(receiveCommand)
            
            if (!Messages || Messages.length === 0) continue

            for (const message of Messages) {
                try {
                    // Process message
                    await handler(message)
                    
                    // On success, delete from queue
                    await client.send(new DeleteMessageCommand({
                        QueueUrl: queueUrl,
                        ReceiptHandle: message.ReceiptHandle
                    }))
                } catch (error) {
                    // On error, we leave the message in the queue for retry 
                    // (unless it's a permanent failure, which the handler should handle internally)
                    log.error({ name, messageId: message.MessageId, error: String(error) }, "Error processing message")
                }
            }
        } catch (error) {
            log.error({ name, error }, "Error polling SQS")
            // exponential backoff or simple delay on polling error
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    }
}
