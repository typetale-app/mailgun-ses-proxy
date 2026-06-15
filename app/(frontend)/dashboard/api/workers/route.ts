import { WorkerRegistry } from "@/lib/core/worker-registry"


/**
 * Returns the live status of all registered SQS background workers.
 * Readable only within the same Node.js process as server.ts.
 *
 * @route GET /dashboard/api/workers
 */
export function GET() {
    const workers = WorkerRegistry.getStatuses()
    const allAlive = workers.length > 0 && workers.every((w) => w.alive)
    return Response.json({ workers, allAlive })
}
