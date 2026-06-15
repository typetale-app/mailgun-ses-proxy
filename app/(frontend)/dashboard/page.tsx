"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatRelativeTime } from "@/lib/utils/web"
import { AlertCircle, ArrowUpRight, CheckCircle2, Inbox, Loader2, Mail, RefreshCw, ShieldAlert, TrendingUp, Wifi, WifiOff } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface StatsData {
    overview: {
        totalBatches: number
        totalMessages: number
        totalErrors: number
        totalDelivered: number
        totalBounced: number
        totalComplaints: number
        deliveryRate: number
    }
    activity: {
        today: number
        thisWeek: number
        thisMonth: number
    }
    recentBatches: {
        id: string
        siteId: string
        batchId: string
        fromEmail: string
        created: string
        messageCount: number
        errorCount: number
    }[]
}

interface WorkerStatus {
    name: string
    alive: boolean
    lastHeartbeat: number | null
    pollCount: number
    startedAt: string | null
    lastError: string | null
}

export default function DashboardPage() {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [workers, setWorkers] = useState<WorkerStatus[]>([])
    const [workersLoading, setWorkersLoading] = useState(true)
    const [workersLastUpdated, setWorkersLastUpdated] = useState<Date | null>(null)

    const fetchWorkers = useCallback(() => {
        fetch("/dashboard/api/workers")
            .then((r) => r.json())
            .then((data) => {
                setWorkers(data.workers ?? [])
                setWorkersLastUpdated(new Date())
            })
            .catch(console.error)
            .finally(() => setWorkersLoading(false))
    }, [])

    useEffect(() => {
        fetch("/dashboard/api/stats")
            .then((r) => r.json())
            .then((data) => setStats(data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetchWorkers()
        const interval = setInterval(fetchWorkers, 15_000)
        return () => clearInterval(interval)
    }, [fetchWorkers])

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!stats) {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                    <CardTitle className="text-destructive">Failed to load dashboard stats</CardTitle>
                    <CardDescription>Please check your connection and try again.</CardDescription>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const statCards = [
        {
            label: "Total Batches",
            value: stats.overview.totalBatches.toLocaleString(),
            icon: Inbox,
            color: "text-primary",
        },
        {
            label: "Messages Sent",
            value: stats.overview.totalMessages.toLocaleString(),
            icon: Mail,
            color: "text-primary",
        },
        {
            label: "Delivery Rate",
            value: `${stats.overview.deliveryRate}%`,
            icon: CheckCircle2,
            color: "text-emerald-500",
        },
        {
            label: "Total Errors",
            value: stats.overview.totalErrors.toLocaleString(),
            icon: AlertCircle,
            color: "text-destructive",
        },
        {
            label: "Bounced",
            value: stats.overview.totalBounced.toLocaleString(),
            icon: ShieldAlert,
            color: "text-orange-500",
        },
        {
            label: "Complaints",
            value: stats.overview.totalComplaints.toLocaleString(),
            icon: TrendingUp,
            color: "text-destructive",
        },
    ]

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground">Monitor your email sending infrastructure at a glance</p>
            </div>

            {/* Worker Health Panel */}
            <Card className="border-muted/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="text-lg">Queue Workers</CardTitle>
                        <CardDescription>Live status of background SQS polling loops</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {workersLastUpdated && (
                            <span className="text-[10px] text-muted-foreground">
                                Updated {workersLastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setWorkersLoading(true); fetchWorkers() }}
                            title="Refresh worker status"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", workersLoading && "animate-spin")} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {workersLoading && workers.length === 0 ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : workers.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            <WifiOff className="h-4 w-4 shrink-0" />
                            No workers registered yet. Workers appear after first server start.
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {workers.map((w) => {
                                const hbAgo = w.lastHeartbeat
                                    ? Math.round((Date.now() - w.lastHeartbeat) / 1000)
                                    : null
                                return (
                                    <div
                                        key={w.name}
                                        className={cn(
                                            "flex flex-col gap-2 rounded-lg border p-4 transition-colors",
                                            w.alive
                                                ? "border-emerald-500/30 bg-emerald-500/5"
                                                : "border-destructive/40 bg-destructive/5",
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium font-mono truncate" title={w.name}>
                                                {w.name}
                                            </span>
                                            {w.alive ? (
                                                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 gap-1">
                                                    <Wifi className="h-3 w-3" /> Running
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="gap-1">
                                                    <WifiOff className="h-3 w-3" /> Dead
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="space-y-1 text-[11px] text-muted-foreground">
                                            <div className="flex justify-between">
                                                <span>Last heartbeat</span>
                                                <span className={cn("font-medium", !w.alive && "text-destructive")}>
                                                    {hbAgo === null
                                                        ? "never"
                                                        : hbAgo < 5
                                                        ? "just now"
                                                        : `${hbAgo}s ago`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Poll count</span>
                                                <span className="font-medium">{w.pollCount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {w.lastError && (
                                            <div className="mt-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive font-mono break-all line-clamp-3" title={w.lastError}>
                                                {w.lastError}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {statCards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Card key={card.label} className="transition-all hover:shadow-md border-muted/50">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {card.label}
                                </CardTitle>
                                <Icon className={cn("h-4 w-4", card.color)} />
                            </CardHeader>
                            <CardContent>
                                <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Activity Summary */}
            <Card className="border-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg">Sending Activity</CardTitle>
                    <CardDescription>Daily, weekly and monthly distribution</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border rounded-lg bg-card/50">
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="text-sm text-muted-foreground mb-1">Today</div>
                        <div className="text-3xl font-bold">{stats.activity.today.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
                            messages
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="text-sm text-muted-foreground mb-1">This Week</div>
                        <div className="text-3xl font-bold">{stats.activity.thisWeek.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
                            messages
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="text-sm text-muted-foreground mb-1">This Month</div>
                        <div className="text-3xl font-bold">{stats.activity.thisMonth.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
                            messages
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Batches */}
            <Card className="border-muted/50">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Recent Newsletter Batches</CardTitle>
                        <CardDescription>Latest campaign activity from Ghost CMS</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (window.location.href = "/dashboard/newsletters")}
                    >
                        View All <ArrowUpRight className="ml-2 h-3 w-3" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {stats.recentBatches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                            <Mail className="h-10 w-10 mb-4" />
                            <p>No newsletter batches yet</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Batch ID</TableHead>
                                    <TableHead>Site</TableHead>
                                    <TableHead>From Email</TableHead>
                                    <TableHead className="text-center">Messages</TableHead>
                                    <TableHead className="text-center">Errors</TableHead>
                                    <TableHead className="text-right">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.recentBatches.map((batch) => (
                                    <TableRow key={batch.id}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {batch.batchId.slice(0, 16)}…
                                        </TableCell>
                                        <TableCell className="font-medium">{batch.siteId}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{batch.fromEmail}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{batch.messageCount}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {batch.errorCount > 0 ? (
                                                <Badge variant="destructive">{batch.errorCount}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className="text-right text-xs text-muted-foreground whitespace-nowrap"
                                            title={new Date(batch.created).toLocaleString()}
                                        >
                                            {formatRelativeTime(batch.created)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
