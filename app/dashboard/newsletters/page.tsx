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
    Mail,
    Loader2
} from "lucide-react"
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from "@/components/ui/card"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatRelativeTime } from "@/lib/utils"

interface Newsletter {
    id: string
    siteId: string
    batchId: string
    fromEmail: string
    created: string
    messageCount: number
    errorCount: number
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

export default function NewslettersPage() {
    const router = useRouter()
    const [data, setData] = useState<Newsletter[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
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
            })
            const res = await fetch(`/dashboard/api/newsletters?${params}`)
            const json = await res.json()
            setData(json.data || [])
            setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [search, sortBy, sortOrder])

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
                <h1 className="text-3xl font-bold tracking-tight">Newsletters</h1>
                <p className="text-muted-foreground">Browse all newsletter batches and their delivery status</p>
            </div>

            <Card className="border-muted/50">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                    <div>
                        <CardTitle className="text-lg">Newsletter Batches</CardTitle>
                        <CardDescription>Campaign history and performance</CardDescription>
                    </div>
                    <form onSubmit={handleSearch} className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            className="w-full bg-accent/50 border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            placeholder="Search by ID, site, or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </form>
                </CardHeader>

                <CardContent>
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center min-h-[300px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                            <Mail className="h-10 w-10 mb-4" />
                            <p>{search ? "No batches match your search" : "No newsletter batches found"}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("batchId")}>
                                        <div className="flex items-center">Batch ID <SortIcon column="batchId" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("siteId")}>
                                        <div className="flex items-center">Site <SortIcon column="siteId" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fromEmail")}>
                                        <div className="flex items-center">From <SortIcon column="fromEmail" /></div>
                                    </TableHead>
                                    <TableHead className="text-center">Messages</TableHead>
                                    <TableHead className="text-center">Errors</TableHead>
                                    <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("created")}>
                                        <div className="flex items-center justify-end">Created <SortIcon column="created" /></div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((batch) => (
                                    <TableRow 
                                        key={batch.id} 
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/dashboard/newsletters/${batch.id}`)}
                                    >
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {batch.batchId.length > 20 ? batch.batchId.slice(0, 20) + "…" : batch.batchId}
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

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t pt-4">
                            <div className="text-xs text-muted-foreground">
                                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> batches
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

