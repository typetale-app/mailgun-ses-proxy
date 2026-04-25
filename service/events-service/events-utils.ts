import { EventsProps, QueryParams } from "@/types/default"
import { prisma } from "../database/db"
import { formatAsMailgunEvent } from "../../lib/core/aws-utils"

/**
 * Generates the "next" URL for Mailgun pagination.
 */
function getNextPageUrl(baseUrl: string, nextStart: number) {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set("start", String(nextStart));
        return url.toString();
    } catch {
        return `${baseUrl}?start=${nextStart}`;
    }
}

/**
 * Retrieves events from the database and formats them for Mailgun API compatibility.
 */
export async function getEmailEvents(params: EventsProps) {
    const skip = params.start || 0;
    const take = params.limit || 300;

    // Handle Mailgun "OR" type filtering (e.g. "delivered OR opened")
    const types = params.type.includes("OR") 
        ? params.type.split("OR").map(s => s.trim().toLowerCase())
        : [params.type.toLowerCase()];

    const timeRange = { 
        gt: new Date(params.begin * 1000), 
        lt: new Date(params.end * 1000) 
    };

    const result = await prisma.newsletterNotifications.findMany({
        skip,
        take,
        orderBy: { id: params.order },
        include: { 
            newsletter: { 
                include: { newsletterBatch: true } 
            } 
        },
        where: {
            type: { in: types },
            newsletter: { 
                newsletterBatch: { siteId: params.siteId } 
            },
            created: timeRange,
        },
    });

    const nextUrl = getNextPageUrl(params.url, skip + take);
    return formatAsMailgunEvent(result, nextUrl);
}

/**
 * Validates and parses Mailgun query parameters.
 */
export function validateQueryParams(searchParams: URLSearchParams): QueryParams {
    const requireParam = (key: string) => {
        const value = searchParams.get(key);
        if (!value) throw new Error(`Missing required query parameter: ${key}`);
        return value;
    };

    return {
        start: parseInt(searchParams.get("start") || "0"),
        limit: parseInt(searchParams.get("limit") || "300"),
        event: requireParam("event"),
        begin: parseInt(requireParam("begin")),
        end: parseInt(requireParam("end")),
        order: searchParams.get("ascending") ? "asc" : "desc",
    };
}

/**
 * High-level wrapper for fetching analytics events.
 */
export async function fetchAnalyticsEvents(queryParams: QueryParams, siteId: string, url: string) {
    return getEmailEvents({
        siteId,
        type: queryParams.event,
        begin: queryParams.begin,
        end: queryParams.end,
        order: queryParams.order,
        limit: queryParams.limit,
        start: queryParams.start,
        url,
    });
}