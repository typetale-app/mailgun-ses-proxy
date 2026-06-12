import { MessageSystemAttributeName, QueueAttributeName, type Message } from "@aws-sdk/client-sqs"
import { Consumer } from "sqs-consumer"
import { sqsClient } from "../../service/aws/awsHelper"
import logger from "./logger"
import { heartbeat, markWorkerDead, registerWorker } from "./worker-registry"

const log = logger.child({ module: "sqs-worker" })

const MAX_RECEIVE_COUNT = 3
const MAX_CONSECUTIVE_ERRORS = 50

const consumers = new Map<string, Consumer>()

export function requestShutdown(): void {
    log.info("Shutdown requested — stopping all SQS consumers")
    consumers.forEach((consumer) => consumer.stop())
}

export interface WorkerConfig {
    name: string
    queueUrl: string
    visibilityTimeout?: number
    waitTimeSeconds?: number
    handler: (message: Message) => Promise<void>
}

/** Describes why a worker stopped. Thrown when the worker's promise settles. */
export class WorkerStopError extends Error {
    constructor(
        public readonly workerName: string,
        public readonly reason: 'circuit-breaker' | 'shutdown' | 'unknown',
        public readonly lastError?: unknown,
    ) {
        const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'no error details')
        super(`Worker "${workerName}" stopped (${reason}): ${detail}`)
        this.name = 'WorkerStopError'
    }
}

export async function startWorker(config: WorkerConfig): Promise<void> {
    const {
        name,
        queueUrl,
        visibilityTimeout = 30,
        waitTimeSeconds = 20,
        handler,
    } = config

    if (!queueUrl) {
        throw new WorkerStopError(name, 'unknown', new Error(`Queue URL is not configured for worker "${name}"`))
    }

    log.info({ name, queueUrl }, `Starting SQS worker: ${name}`)
    registerWorker(name)

    let consecutiveErrors = 0
    let lastError: unknown = undefined
    let stopReason: 'circuit-breaker' | 'shutdown' | 'unknown' = 'unknown'

    const consumer = Consumer.create({
        queueUrl,
        sqs: sqsClient(),
        batchSize: 1,
        visibilityTimeout,
        waitTimeSeconds,
        attributeNames: ["All"] as QueueAttributeName[],
        messageAttributeNames: ["All"],
        messageSystemAttributeNames: [
            MessageSystemAttributeName.SentTimestamp,
            MessageSystemAttributeName.ApproximateReceiveCount,
        ],

        handleMessageBatch: async (messages) => {
            const acknowledged: Message[] = []
            let anyHandlerSuccess = false

            for (const msg of messages) {
                const receiveCount = parseInt(
                    msg.Attributes?.ApproximateReceiveCount ?? "0",
                    10,
                )

                if (receiveCount > MAX_RECEIVE_COUNT) {
                    log.error(
                        { name, messageId: msg.MessageId, receiveCount },
                        "Message exceeded max receive count — discarding",
                    )
                    acknowledged.push(msg)
                    continue
                }

                try {
                    await handler(msg)
                    acknowledged.push(msg)
                    anyHandlerSuccess = true
                } catch (err) {
                    log.error(
                        { name, messageId: msg.MessageId, receiveCount, err },
                        "Handler error — message left in SQS for retry",
                    )
                }
            }

            if (anyHandlerSuccess) heartbeat(name)

            return acknowledged
        },
    })

    attachLifecycleEvents(consumer, name,
        () => consecutiveErrors,
        (n) => { consecutiveErrors = n },
        (err) => { lastError = err },
        () => { stopReason = 'circuit-breaker' },
    )

    consumers.set(name, consumer)
    consumer.start()

    return new Promise<void>((_, reject) => {
        consumer.on("stopped", () => {
            markWorkerDead(name, stopReason)
            consumers.delete(name)
            reject(new WorkerStopError(name, stopReason, lastError))
        })
    })
}

function attachLifecycleEvents(
    consumer: Consumer,
    name: string,
    getErrors: () => number,
    setErrors: (n: number) => void,
    setLastError: (err: unknown) => void,
    markCircuitBreaker: () => void,
): void {
    consumer.on("empty", () => heartbeat(name))

    consumer.on("error", (err) => {
        const count = getErrors() + 1
        setErrors(count)
        setLastError(err)
        log.error(
            { name, err, consecutiveErrors: count },
            `SQS consumer error (${count}/${MAX_CONSECUTIVE_ERRORS})`,
        )
        if (count >= MAX_CONSECUTIVE_ERRORS) {
            log.error({ name }, "Circuit breaker tripped — stopping consumer")
            markCircuitBreaker()
            consumer.stop()
        }
    })

    consumer.on("message_processed", () => setErrors(0))
}
