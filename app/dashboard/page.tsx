"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatRelativeTime } from "@/lib/utils"
import { AlertCircle, ArrowUpRight, CheckCircle2, Inbox, Loader2, Mail, ShieldAlert, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

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

export default function DashboardPage() {
    const [stats, setStats] = useState<StatsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/dashboard/api/stats")
            .then((r) => r.json())
            .then((data) => setStats(data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

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
