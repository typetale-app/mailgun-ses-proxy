import { MessageSystemAttributeName, QueueAttributeName, type Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { awsService } from "../../service/aws-service";
import logger from "./logger";
import { WorkerRegistry } from "./worker-registry";

export interface WorkerConfig {
    name: string;
    queueUrl: string;
    visibilityTimeout?: number;
    waitTimeSeconds?: number;
    handler: (message: Message) => Promise<void>;
}

export type WorkerStopReason = 'circuit-breaker' | 'shutdown' | 'unknown';

/** Describes why a worker stopped. Thrown when the worker's promise settles. */
export class WorkerStopError extends Error {
    constructor(
        public readonly workerName: string,
        public readonly reason: WorkerStopReason,
        public readonly lastError?: unknown,
    ) {
        const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'no error details');
        super(`Worker "${workerName}" stopped (${reason}): ${detail}`);
        this.name = 'WorkerStopError';
    }
}

/**
 * Individual instance of an SQS Consumer Worker
 */
export class SQSWorker {
    private consumer: Consumer | null = null;
    private consecutiveErrors = 0;
    private lastError: unknown = undefined;
    private stopReason: WorkerStopReason = 'unknown';

    private readonly MAX_RECEIVE_COUNT = 3;
    private readonly MAX_CONSECUTIVE_ERRORS = 50;

    private readonly log = logger.child({ module: "SQSWorker" });

    constructor(private readonly config: WorkerConfig) {
        if (!this.config.queueUrl) {
            throw new WorkerStopError(
                this.config.name,
                'unknown',
                new Error(`Queue URL is not configured for worker "${this.config.name}"`)
            );
        }
    }

    /**
     * Spawns the consumer and returns a promise that rejects when the consumer stops.
     */
    public start(): Promise<void> {
        const { name, queueUrl, visibilityTimeout = 30, waitTimeSeconds = 20 } = this.config;

        this.log.info({ name, queueUrl }, `Starting SQS worker: ${name}`);
        WorkerRegistry.register(name)

        this.consumer = Consumer.create({
            queueUrl,
            sqs: awsService.sqsClient(),
            batchSize: 1,
            visibilityTimeout,
            waitTimeSeconds,
            attributeNames: ["All"] as QueueAttributeName[],
            messageAttributeNames: ["All"],
            messageSystemAttributeNames: [
                MessageSystemAttributeName.SentTimestamp,
                MessageSystemAttributeName.ApproximateReceiveCount,
            ],
            handleMessageBatch: (messages) => this.handleMessageBatch(messages)
        })

        this.attachLifecycleEvents()
        this.consumer.start()

        return new Promise<void>((_, reject) => {
            this.consumer?.on("stopped", () => {
                WorkerRegistry.markDead(name, this.stopReason)
                reject(new WorkerStopError(name, this.stopReason, this.lastError))
            })
        })
    }

    /**
     * Gracefully stop this specific consumer instance
     */
    public stop(reason: WorkerStopReason = 'shutdown'): void {
        this.stopReason = reason;
        this.consumer?.stop();
    }

    private async handleMessageBatch(messages: Message[]): Promise<Message[]> {
        const acknowledged: Message[] = [];
        let anyHandlerSuccess = false;

        for (const msg of messages) {
            const receiveCount = parseInt(msg.Attributes?.ApproximateReceiveCount ?? "0", 10);

            if (receiveCount > this.MAX_RECEIVE_COUNT) {
                this.log.error(
                    { name: this.config.name, messageId: msg.MessageId, receiveCount },
                    "Message exceeded max receive count — discarding",
                );
                acknowledged.push(msg);
                continue;
            }

            try {
                await this.config.handler(msg);
                acknowledged.push(msg);
                anyHandlerSuccess = true;
            } catch (err) {
                this.log.error(
                    { name: this.config.name, messageId: msg.MessageId, receiveCount, err },
                    "Handler error — message left in SQS for retry",
                );
            }
        }

        if (anyHandlerSuccess) {
            WorkerRegistry.heartbeat(this.config.name);
        }

        return acknowledged;
    }

    private attachLifecycleEvents(): void {
        if (!this.consumer) return;
        const { name } = this.config;

        this.consumer.on("empty", () => WorkerRegistry.heartbeat(name));

        this.consumer.on("error", (err) => {
            this.consecutiveErrors++;
            this.lastError = err;

            this.log.error(
                { name, err, consecutiveErrors: this.consecutiveErrors },
                `SQS consumer error (${this.consecutiveErrors}/${this.MAX_CONSECUTIVE_ERRORS})`,
            );

            if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
                this.log.error({ name }, "Circuit breaker tripped — stopping consumer");
                this.stop('circuit-breaker');
            }
        });

        this.consumer.on("message_processed", () => {
            this.consecutiveErrors = 0;
        });
    }
}

/**
 * Orchestrator to manage global consumer states and shutdowns
 */
export class SQSWorkerManager {
    private static workers = new Map<string, SQSWorker>();
    private static readonly log = logger.child({ module: "SQSWorkerManager" });

    /**
     * Starts a worker and handles its lifecycle management.
     */
    public static async startWorker(config: WorkerConfig): Promise<void> {
        const worker = new SQSWorker(config);
        this.workers.set(config.name, worker);
        try {
            await worker.start();
        } finally {
            this.workers.delete(config.name);
        }
    }

    /**
     * Requests graceful shutdown for all registered workers.
     */
    public static requestShutdown(): void {
        this.log.info("Shutdown requested — stopping all SQS consumers");
        this.workers.forEach((worker) => worker.stop('shutdown'));
    }
}

// Export legacy standalone functions if you don't want to break existing imports elsewhere
export const startWorker = SQSWorkerManager.startWorker.bind(SQSWorkerManager);
export const requestShutdown = SQSWorkerManager.requestShutdown.bind(SQSWorkerManager);