"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

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

    const sortIndicator = (column: string) => {
        if (sortBy !== column) return ""
        return sortOrder === "asc" ? " ↑" : " ↓"
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(1)
    }

    return (
        <div>
            <h1 className="dash-page-title">Newsletters</h1>
            <p className="dash-page-desc">Browse all newsletter batches and their delivery status</p>

            <div className="dash-section">
                <div className="dash-section-header">
                    <div className="dash-section-title">Newsletter Batches</div>
                    <div className="dash-toolbar">
                        <form onSubmit={handleSearch} className="dash-search">
                            <svg className="dash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                className="dash-search-input"
                                placeholder="Search by batch ID, site, or email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </form>
                    </div>
                </div>

                <div className="dash-section-body">
                    {loading ? (
                        <div className="dash-loading"><div className="dash-spinner" /></div>
                    ) : data.length === 0 ? (
                        <div className="dash-empty">
                            <div className="dash-empty-icon">📭</div>
                            <div className="dash-empty-text">
                                {search ? "No batches match your search" : "No newsletter batches found"}
                            </div>
                        </div>
                    ) : (
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead>
                                    <tr>
                                        <th className={sortBy === "batchId" ? "sorted" : ""} onClick={() => handleSort("batchId")}>
                                            Batch ID{sortIndicator("batchId")}
                                        </th>
                                        <th className={sortBy === "siteId" ? "sorted" : ""} onClick={() => handleSort("siteId")}>
                                            Site{sortIndicator("siteId")}
                                        </th>
                                        <th className={sortBy === "fromEmail" ? "sorted" : ""} onClick={() => handleSort("fromEmail")}>
                                            From{sortIndicator("fromEmail")}
                                        </th>
                                        <th>Messages</th>
                                        <th>Errors</th>
                                        <th className={sortBy === "created" ? "sorted" : ""} onClick={() => handleSort("created")}>
                                            Created{sortIndicator("created")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((batch) => (
                                        <tr
                                            key={batch.id}
                                            style={{ cursor: "pointer" }}
                                            onClick={() => router.push(`/dashboard/newsletters/${batch.id}`)}
                                        >
                                            <td className="dash-table-mono" title={batch.batchId}>
                                                {batch.batchId.length > 20 ? batch.batchId.slice(0, 20) + "…" : batch.batchId}
                                            </td>
                                            <td>{batch.siteId}</td>
                                            <td title={batch.fromEmail}>
                                                {batch.fromEmail.length > 30 ? batch.fromEmail.slice(0, 30) + "…" : batch.fromEmail}
                                            </td>
                                            <td>
                                                <span className="dash-badge dash-badge-delivery">{batch.messageCount}</span>
                                            </td>
                                            <td>
                                                {batch.errorCount > 0 ? (
                                                    <span className="dash-badge dash-badge-bounce">{batch.errorCount}</span>
                                                ) : (
                                                    <span style={{ color: "var(--dash-text-dim)" }}>—</span>
                                                )}
                                            </td>
                                            <td>{new Date(batch.created).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="dash-pagination">
                        <span>
                            Showing {(pagination.page - 1) * pagination.limit + 1}–
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </span>
                        <div className="dash-pagination-buttons">
                            <button
                                className="dash-pagination-btn"
                                disabled={pagination.page <= 1}
                                onClick={() => fetchData(pagination.page - 1)}
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                                const pageNum = start + i
                                if (pageNum > pagination.totalPages) return null
                                return (
                                    <button
                                        key={pageNum}
                                        className={`dash-pagination-btn ${pageNum === pagination.page ? "active" : ""}`}
                                        onClick={() => fetchData(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                            <button
                                className="dash-pagination-btn"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => fetchData(pagination.page + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
