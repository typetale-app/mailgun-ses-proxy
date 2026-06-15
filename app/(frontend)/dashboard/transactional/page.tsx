"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    Search,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    Send,
    Loader2,
    Filter,
} from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatRelativeTime } from "@/lib/utils/web"

interface TransactionalEmail {
    id: string
    messageId: string
    fromEmail: string
    toEmail: string
    subject: string
    status: string
    created: string
    updated: string
    eventCount: number
    lastEventType: string | null
    lastEventAt: string | null
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

const statusStyles: Record<string, string> = {
    sent: "bg-emerald-500/10 text-emerald-500",
    pending: "bg-amber-500/10 text-amber-500",
    error: "bg-destructive/10 text-destructive",
}

const eventBadgeStyles: Record<string, string> = {
    Delivery: "bg-emerald-500/10 text-emerald-500",
    Bounce: "bg-destructive/10 text-destructive",
    Complaint: "bg-amber-500/10 text-amber-500",
    Send: "bg-blue-500/10 text-blue-500",
}

export default function TransactionalPage() {
    const router = useRouter()
    const [data, setData] = useState<TransactionalEmail[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [sortBy, setSortBy] = useState("created")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

    const fetchData = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "20",
                sortBy,
                sortOrder,
                ...(search ? { search } : {}),
                ...(statusFilter ? { status: statusFilter } : {}),
            })
            const res = await fetch(`/dashboard/api/transactional?${params}`)
            const json = await res.json()
            setData(json.data || [])
            setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, sortBy, sortOrder])

    useEffect(() => {
        fetchData(1)
    }, [fetchData])

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        } else {
            setSortBy(column)
            setSortOrder("desc")
        }
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
        return sortOrder === "asc"
            ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
            : <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(1)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Transactional Emails</h1>
                <p className="text-muted-foreground">Browse system/transactional emails sent via SES and track their delivery status</p>
            </div>

            <Card className="border-muted/50">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                    <div>
                        <CardTitle className="text-lg">System Emails</CardTitle>
                        <CardDescription>Transactional emails sent through the proxy</CardDescription>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-36">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <select
                                className="w-full bg-accent/50 border rounded-lg pl-10 pr-4 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Status</option>
                                <option value="sent">Sent</option>
                                <option value="pending">Pending</option>
                                <option value="error">Error</option>
                            </select>
                        </div>
                        <form onSubmit={handleSearch} className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full bg-accent/50 border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Search by email, subject..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </form>
                    </div>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center min-h-[300px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                            <Send className="h-10 w-10 mb-4" />
                            <p>{search || statusFilter ? "No emails match your filters" : "No transactional emails found"}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("subject")}>
                                        <div className="flex items-center">Subject <SortIcon column="subject" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("toEmail")}>
                                        <div className="flex items-center">To <SortIcon column="toEmail" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fromEmail")}>
                                        <div className="flex items-center">From <SortIcon column="fromEmail" /></div>
                                    </TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center">Events</TableHead>
                                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("created")}>
                                        <div className="flex items-center justify-end">Sent <SortIcon column="created" /></div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((mail) => (
                                    <TableRow
                                        key={mail.id}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/dashboard/transactional/${mail.id}`)}
                                    >
                                        <TableCell className="max-w-[250px] truncate font-medium" title={mail.subject}>
                                            {mail.subject}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">{mail.toEmail}</TableCell>
                                        <TableCell className="max-w-[180px] truncate text-muted-foreground">{mail.fromEmail}</TableCell>
                                        <TableCell className="text-center">
                                            {mail.lastEventType ? (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "px-2 py-0.5 text-[10px] font-semibold border-none",
                                                        eventBadgeStyles[mail.lastEventType] || "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {mail.lastEventType}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="text-[10px]">
                                                {mail.eventCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell
                                            className="text-right text-xs text-muted-foreground whitespace-nowrap"
                                            title={new Date(mail.created).toLocaleString()}
                                        >
                                            {formatRelativeTime(mail.created)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t pt-4">
                            <div className="text-xs text-muted-foreground">
                                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> emails
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchData(pagination.page - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                                        const pageNum = start + i
                                        if (pageNum > pagination.totalPages) return null
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={pageNum === pagination.page ? "default" : "ghost"}
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => fetchData(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        )
                                    })}
                                </div>
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
    )
}
