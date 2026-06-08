"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatRelativeTime } from "@/lib/utils/web"
import {
    AlertCircle,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Hash,
    Loader2,
    Mail,
    Send,
    User,
} from "lucide-react"
import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"

interface MailDetail {
    id: string
    messageId: string
    fromEmail: string
    toEmail: string
    subject: string
    status: string
    created: string
    updated: string
}

interface EventItem {
    id: string
    type: string
    notificationId: string
    messageId: string
    timestamp: string
    created: string
    rawEvent: string
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

const statusStyles: Record<string, string> = {
    sent: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    error: "bg-destructive/15 text-destructive border-destructive/30",
}

const eventTypeStyles: Record<string, string> = {
    Delivery: "bg-emerald-500/10 text-emerald-500",
    Bounce: "bg-destructive/10 text-destructive",
    Complaint: "bg-amber-500/10 text-amber-500",
    Send: "bg-blue-500/10 text-blue-500",
}

export default function TransactionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [mail, setMail] = useState<MailDetail | null>(null)
    const [events, setEvents] = useState<EventItem[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

    const fetchData = useCallback(
        async (page = 1) => {
            setLoading(true)
            try {
                const res = await fetch(`/dashboard/api/transactional/${id}?eventsPage=${page}&eventsLimit=20`)
                const json = await res.json()
                setMail(json.mail)
                setEvents(json.events?.data || [])
                setPagination(json.events?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        },
        [id],
    )

    useEffect(() => {
        fetchData(1)
    }, [fetchData])

    const toggleEventExpand = (eventId: string) => {
        setExpandedEvent(expandedEvent === eventId ? null : eventId)
    }

    const formatRawEvent = (raw: string): string => {
        try {
            return JSON.stringify(JSON.parse(raw), null, 2)
        } catch {
            return raw
        }
    }

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!mail) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                <AlertCircle className="h-10 w-10 mb-4" />
                <p>Transactional email not found</p>
                <Link
                    href="/dashboard/transactional"
                    className="mt-4 text-primary hover:underline flex items-center gap-2"
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Transactional Emails
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/transactional">
                    <Button variant="ghost" size="sm" className="-ml-2">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Email Details</h1>
            </div>

            {/* Email Info Header */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" /> Subject
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold leading-snug" title={mail.subject}>
                            {mail.subject}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <User className="h-3 w-3" /> Recipients
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold">{mail.toEmail}</div>
                        <div className="text-[10px] text-muted-foreground truncate">From: {mail.fromEmail}</div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Date Sent
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold">{formatRelativeTime(mail.created)}</div>
                        <div className="text-[10px] text-muted-foreground">
                            {new Date(mail.created).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Hash className="h-3 w-3" /> Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3">
                        <Badge
                            variant="outline"
                            className={cn(
                                "capitalize px-3 py-1 text-xs font-semibold",
                                statusStyles[mail.status] || "bg-muted text-muted-foreground",
                            )}
                        >
                            {mail.status}
                        </Badge>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Events</span>
                            <span className="text-sm font-bold">{pagination.total}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Message ID */}
            <Card className="border-muted/50 bg-card/50">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                    <Send className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">SES Message ID</div>
                        <div className="text-xs font-mono truncate" title={mail.messageId}>
                            {mail.messageId}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Events Timeline */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Notification Events</h2>
                <Card className="border-muted/50">
                    <CardContent className="p-0">
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                <Send className="h-10 w-10 mb-4" />
                                <p>No notification events recorded yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Events appear as SES processes the email</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Notification ID</TableHead>
                                        <TableHead className="text-right">Timestamp</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((event) => (
                                        <>
                                            <TableRow
                                                key={event.id}
                                                className="cursor-pointer hover:bg-accent/50 transition-colors"
                                                onClick={() => toggleEventExpand(event.id)}
                                            >
                                                <TableCell className="text-center">
                                                    {expandedEvent === event.id ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "px-2 py-0.5 text-[10px] font-semibold border-none",
                                                            eventTypeStyles[event.type] || "bg-muted text-muted-foreground",
                                                        )}
                                                    >
                                                        {event.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground max-w-[250px] truncate" title={event.notificationId}>
                                                    {event.notificationId}
                                                </TableCell>
                                                <TableCell
                                                    className="text-right text-xs text-muted-foreground whitespace-nowrap"
                                                    title={new Date(event.timestamp).toLocaleString()}
                                                >
                                                    {formatRelativeTime(event.timestamp)}
                                                    <div className="text-[10px]">
                                                        {new Date(event.timestamp).toLocaleString()}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {expandedEvent === event.id && (
                                                <TableRow key={`${event.id}-raw`}>
                                                    <TableCell colSpan={4} className="bg-accent/20 p-0">
                                                        <div className="p-4">
                                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                                                Raw SES Event
                                                            </div>
                                                            <pre className="text-xs font-mono text-muted-foreground bg-background/50 rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto border">
                                                                {formatRawEvent(event.rawEvent)}
                                                            </pre>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))}
                                </TableBody>
                            </Table>
                        )}

                        {pagination.totalPages > 1 && (
                            <div className="p-4 border-t flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                    Page <span className="font-medium">{pagination.page}</span> of{" "}
                                    <span className="font-medium">{pagination.totalPages}</span>
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page <= 1}
                                        onClick={() => fetchData(pagination.page - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => fetchData(pagination.page + 1)}
                                    >
                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
