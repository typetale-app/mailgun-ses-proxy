export interface WorkerStatus {
    name: string;
    lastHeartbeat: number | null; // epoch ms of the last successful poll
    alive: boolean;
    pollCount: number;
    startedAt: string | null;
    lastError: string | null;
}

// Use a Symbol on globalThis so the Map survives Next.js re-bundling.
const REGISTRY_KEY = Symbol.for("mailgun-ses-proxy:worker-registry");

/**
 * Thread-safe, cross-bundle In-process worker heartbeat registry.
 * Shared between worker loops and the dashboard API route.
 */
export class WorkerRegistry {
    /**
     * Internal helper to fetch the global state map instance.
     * Keeps the map persistent across Next.js re-bundling during local dev.
     */
    private static get registry(): Map<string, WorkerStatus> {
        const g = globalThis as Record<symbol, unknown>;
        if (!g[REGISTRY_KEY]) {
            g[REGISTRY_KEY] = new Map<string, WorkerStatus>();
        }
        return g[REGISTRY_KEY] as Map<string, WorkerStatus>;
    }

    /**
     * Registers a worker at loop start.
     */
    public static register(name: string): void {
        this.registry.set(name, {
            name,
            lastHeartbeat: null,
            alive: false,
            pollCount: 0,
            startedAt: new Date().toISOString(),
            lastError: null,
        });
    }

    /**
     * Called on every successful poll iteration (idle or with messages).
     */
    public static heartbeat(name: string): void {
        const entry = this.registry.get(name);
        if (!entry) return;

        entry.lastHeartbeat = Date.now();
        entry.alive = true;
        entry.pollCount += 1;
        entry.lastError = null;
    }

    /**
     * Marks a worker as dead and stores the last error.
     */
    public static markDead(name: string, error: unknown): void {
        const entry = this.registry.get(name);
        if (!entry) return;

        entry.alive = false;
        entry.lastError = error instanceof Error ? error.message : String(error);
    }

    /**
     * Returns a liveness snapshot of all workers.
     * A worker is considered stale if its heartbeat is older than `staleThresholdMs`
     * (default 60 s — comfortably above the 20 s SQS long-poll wait).
     */
    public static getStatuses(staleThresholdMs = 60_000): WorkerStatus[] {
        const now = Date.now();
        return Array.from(this.registry.values()).map((w) => ({
            ...w,
            alive:
                w.alive &&
                w.lastHeartbeat !== null &&
                now - w.lastHeartbeat < staleThresholdMs,
        }));
    }
}