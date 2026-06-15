import { WorkerRegistry } from "@/lib/core/worker-registry"

/**
 * Endpoint to check the health of the server
 * @route GET /healthcheck
 * @returns Response{ timestamp: Date, status: number, workers: WorkerStatus[], allWorkersAlive: boolean }
 */
export function GET() {
    const workers = WorkerRegistry.getStatuses()
    const allWorkersAlive = workers.length === 0 || workers.every(w => w.alive)
    const status = allWorkersAlive ? 200 : 503
    return Response.json({
        timestamp: new Date(),
        status,
        workers,
        allWorkersAlive,
    }, { status })
}
