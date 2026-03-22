import logger from "@/lib/core/logger";
import { getNewsletterUsage } from "@/service/stats-service";

const log = logger.child({ path: "app/stats/[action]" })

type pathParam = { params: Promise<{ action: string }> }

export async function POST(req: Request, { params }: pathParam) {
    try {
        const input = (await req.json()) as { from: number; to: number; siteId: string }
        switch ((await params).action) {
            case "getNewsletterUsage":
                const result = await getNewsletterUsage(input)
                return Response.json(result)
            default:
                return Response.json({ message: "Invalid action" }, { status: 400 })
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            return Response.json({ message: "Invalid JSON in request body" }, { status: 400 })
        }
        log.error(error, "Error in stats route")
        return Response.json({ message: "Internal server error" }, { status: 500 })
    }
}
