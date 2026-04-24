import logger from "@/lib/core/logger"
import { fetchAnalyticsEvents, validateQueryParams } from "@/service/events-service/events-utils"
import { NextRequest } from "next/server"

const log = logger.child({ path: "app/v3/events" })
type pathParam = { params: Promise<{ siteId: string, slug?: string[] }> }

/**
 * GET /api/v3/events/{siteId}/{...slug}
 * 
 * Retrieves analytics events for a specific site with optional filtering parameters.
 * 
 * @param req - The Next.js request object containing query parameters
 * @param params - Path parameters containing siteId and optional slug array
 * @param params.siteId - The unique identifier for the site
 * @param params.slug - Optional array of additional path segments
 * 
 * @returns JSON response containing analytics events data or error message
 * 
 */
async function fetchAnalyticsEvent(req: NextRequest, { params }: pathParam) {
    const { siteId, slug } = await params
    try {
        const queryParams = validateQueryParams(req.nextUrl.searchParams)
        log.debug({ queryParams, siteId, slug }, "query params")
        const events = await fetchAnalyticsEvents(queryParams, siteId, req.url)
        log.debug({ count: events.items.length, siteId, slug }, "analytics events count")
        return Response.json(events, { status: 200 })
    } catch (e) {
        log.error(e, 'error when fetching analytics events')
        const errorMessage = e instanceof Error ? e.message : "An error occurred";
        return Response.json({ message: errorMessage }, { status: 400 })
    }
}

export const GET = fetchAnalyticsEvent 