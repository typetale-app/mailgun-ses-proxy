"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatRelativeTime } from "@/lib/utils"
import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, Globe, Hash, Info, Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"

interface BatchDetail {
    id: string
    siteId: string
    batchId: string
    fromEmail: string
    created: string
}

interface Message {
    id: string
    messageId: string
    toEmail: string
    created: string
    eventCount: number
}

interface ErrorEntry {
    id: string
    toEmail: string
    error: string
    created: string
    messageId: string
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

export default function NewsletterDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [batch, setBatch] = useState<BatchDetail | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [errors, setErrors] = useState<ErrorEntry[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<"messages" | "errors">("messages")

    const fetchData = useCallback(
        async (page = 1) => {
            setLoading(true)
            try {
                const res = await fetch(`/dashboard/api/newsletters/${id}?page=${page}&limit=20`)
                const json = await res.json()
                setBatch(json.batch)
                setMessages(json.messages?.data || [])
                setErrors(json.errors?.data || [])
                setPagination(json.messages?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
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

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!batch) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                <AlertCircle className="h-10 w-10 mb-4" />
                <p>Newsletter batch not found</p>
                <Link
                    href="/dashboard/newsletters"
                    className="mt-4 text-primary hover:underline flex items-center gap-2"
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Newsletters
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/newsletters">
                    <Button variant="ghost" size="sm" className="-ml-2">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Batch Details</h1>
            </div>

            {/* Batch Info Header */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Hash className="h-3 w-3" /> Batch ID
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs font-mono truncate" title={batch.batchId}>
                            {batch.batchId}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Globe className="h-3 w-3" /> Site / Provider
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold">{batch.siteId}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{batch.fromEmail}</div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Date Created
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-semibold">{formatRelativeTime(batch.created)}</div>
                        <div className="text-[10px] text-muted-foreground">
                            {new Date(batch.created).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-muted/50 bg-card/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                            <Info className="h-3 w-3" /> Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Sent</span>
                            <span className="text-sm font-bold text-emerald-500">{pagination.total}</span>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">Errors</span>
                            <span
                                className={cn(
                                    "text-sm font-bold",
                                    errors.length > 0 ? "text-destructive" : "text-muted-foreground",
                                )}
                            >
                                {errors.length}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Content Tabs */}
            <div className="space-y-4">
                <div className="flex p-1 bg-accent/30 rounded-xl w-fit">
                    <button
                        onClick={() => setTab("messages")}
                        className={cn(
                            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
                            tab === "messages"
                                ? "bg-card shadow-sm text-primary"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        Messages
                    </button>
                    <button
                        onClick={() => setTab("errors")}
                        className={cn(
                            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
                            tab === "errors"
                                ? "bg-card shadow-sm text-destructive"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        Errors
                    </button>
                </div>

                <Card className="border-muted/50">
                    <CardContent className="p-0">
                        {tab === "messages" ? (
                            <>
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                        <Mail className="h-10 w-10 mb-4" />
                                        <p>No messages sent in this batch</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Message ID</TableHead>
                                                <TableHead>Recipient</TableHead>
                                                <TableHead className="text-center">Events</TableHead>
                                                <TableHead className="text-right">Sent At</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {messages.map((msg) => (
                                                <TableRow key={msg.id}>
                                                    <TableCell
                                                        className="font-mono text-[10px] text-muted-foreground max-w-[200px] truncate"
                                                        title={msg.messageId}
                                                    >
                                                        {msg.messageId}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{msg.toEmail}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Link href={`/dashboard/events?search=${encodeURIComponent(msg.messageId)}`}>
                                                            <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer transition-colors">
                                                                {msg.eventCount}
                                                            </Badge>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell
                                                        className="text-right text-xs text-muted-foreground"
                                                        title={new Date(msg.created).toLocaleString()}
                                                    >
                                                        {formatRelativeTime(msg.created)}
                                                    </TableCell>
                                                </TableRow>
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
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={pagination.page >= pagination.totalPages}
                                                onClick={() => fetchData(pagination.page + 1)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {errors.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50 text-emerald-500">
                                        <CheckCircle2 className="h-10 w-10 mb-4" />
                                        <p>Clean run! No errors recorded.</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Recipient</TableHead>
                                                <TableHead>Error Message</TableHead>
                                                <TableHead className="text-right">Timestamp</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {errors.map((err) => (
                                                <TableRow key={err.id} className="hover:bg-destructive/5">
                                                    <TableCell className="font-medium">{err.toEmail}</TableCell>
                                                    <TableCell className="text-sm text-destructive leading-relaxed max-w-md">
                                                        {err.error}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {new Date(err.created).toLocaleDateString()}
                                                        <div className="text-[10px]">
                                                            {new Date(err.created).toLocaleTimeString()}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
