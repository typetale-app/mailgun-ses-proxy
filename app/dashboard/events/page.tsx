"use client"

import { useState, useEffect, useCallback } from "react"

interface EventItem {
    id: string
    type: string
    notificationId: string
    messageId: string
    toEmail: string
    timestamp: string
    created: string
}

interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

const badgeClass: Record<string, string> = {
    Delivery: "dash-badge-delivery",
    Bounce: "dash-badge-bounce",
    Complaint: "dash-badge-complaint",
}

export default function EventsPage() {
    const [data, setData] = useState<EventItem[]>([])
    const [eventTypes, setEventTypes] = useState<string[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("")
    const [sortBy, setSortBy] = useState("timestamp")
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
                ...(typeFilter ? { type: typeFilter } : {}),
            })
            const res = await fetch(`/dashboard/api/events?${params}`)
            const json = await res.json()
            setData(json.data || [])
            setEventTypes(json.eventTypes || [])
            setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [search, typeFilter, sortBy, sortOrder])

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
            <h1 className="dash-page-title">Events</h1>
            <p className="dash-page-desc">Track email delivery notifications, bounces, and complaints</p>

            <div className="dash-section">
                <div className="dash-section-header">
                    <div className="dash-section-title">Notification Events</div>
                    <div className="dash-toolbar">
                        <select
                            className="dash-filter-select"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <option value="">All Types</option>
                            {eventTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <form onSubmit={handleSearch} className="dash-search">
                            <svg className="dash-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                className="dash-search-input"
                                placeholder="Search by message or notification ID..."
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
                            <div className="dash-empty-icon">📡</div>
                            <div className="dash-empty-text">
                                {search || typeFilter ? "No events match your filters" : "No notification events found"}
                            </div>
                        </div>
                    ) : (
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead>
                                    <tr>
                                        <th className={sortBy === "type" ? "sorted" : ""} onClick={() => handleSort("type")}>
                                            Type{sortIndicator("type")}
                                        </th>
                                        <th>Recipient</th>
                                        <th className={sortBy === "messageId" ? "sorted" : ""} onClick={() => handleSort("messageId")}>
                                            Message ID{sortIndicator("messageId")}
                                        </th>
                                        <th>Notification ID</th>
                                        <th className={sortBy === "timestamp" ? "sorted" : ""} onClick={() => handleSort("timestamp")}>
                                            Timestamp{sortIndicator("timestamp")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((event) => (
                                        <tr key={event.id}>
                                            <td>
                                                <span className={`dash-badge ${badgeClass[event.type] || "dash-badge-default"}`}>
                                                    {event.type}
                                                </span>
                                            </td>
                                            <td>{event.toEmail}</td>
                                            <td className="dash-table-mono" title={event.messageId}>
                                                {event.messageId.length > 24 ? event.messageId.slice(0, 24) + "…" : event.messageId}
                                            </td>
                                            <td className="dash-table-mono" title={event.notificationId}>
                                                {event.notificationId.length > 20 ? event.notificationId.slice(0, 20) + "…" : event.notificationId}
                                            </td>
                                            <td>{new Date(event.timestamp).toLocaleString()}</td>
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
