/**
 * Endpoint to check the health of the server
 * @route GET /healthcheck
 * @returns Response{ timestamp: Date, status: number, workers: WorkerStatus[], allWorkersAlive: boolean }
 */

import { getWorkerStatuses } from "@/lib/core/worker-registry"

export function GET() {
    const workers = getWorkerStatuses()

    // If workers have been registered, all must be alive for a healthy status.
    // If no workers are registered yet (early startup), report healthy to
    // avoid failing readiness probes before workers have had time to start.
    const allWorkersAlive = workers.length === 0 || workers.every(w => w.alive)
    const status = allWorkersAlive ? 200 : 503

    return Response.json({
        timestamp: new Date(),
        status,
        workers,
        allWorkersAlive,
    }, { status })
}
