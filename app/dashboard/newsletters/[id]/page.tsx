"use client"

import { useState, useEffect, useCallback, use } from "react"

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

    const fetchData = useCallback(async (page = 1) => {
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
    }, [id])

    useEffect(() => {
        fetchData(1)
    }, [fetchData])

    if (loading) {
        return <div className="dash-loading"><div className="dash-spinner" /></div>
    }

    if (!batch) {
        return (
            <div className="dash-empty">
                <div className="dash-empty-icon">❌</div>
                <div className="dash-empty-text">Batch not found</div>
            </div>
        )
    }

    return (
        <div>
            <a
                href="/dashboard/newsletters"
                style={{ fontSize: 13, color: "var(--dash-text-dim)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
            >
                ← Back to Newsletters
            </a>

            <h1 className="dash-page-title">Batch Details</h1>

            {/* Batch Info */}
            <div className="dash-section" style={{ marginBottom: 24 }}>
                <div className="dash-section-body" style={{ padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        <div>
                            <div className="dash-stat-label">Batch ID</div>
                            <div style={{ fontSize: 13, fontFamily: "monospace", color: "var(--dash-text)" }}>{batch.batchId}</div>
                        </div>
                        <div>
                            <div className="dash-stat-label">Site</div>
                            <div style={{ fontSize: 14, color: "var(--dash-text)" }}>{batch.siteId}</div>
                        </div>
                        <div>
                            <div className="dash-stat-label">From</div>
                            <div style={{ fontSize: 14, color: "var(--dash-text)" }}>{batch.fromEmail}</div>
                        </div>
                        <div>
                            <div className="dash-stat-label">Created</div>
                            <div style={{ fontSize: 14, color: "var(--dash-text)" }}>{new Date(batch.created).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="dash-stat-label">Messages</div>
                            <div style={{ fontSize: 14 }}>
                                <span className="dash-badge dash-badge-delivery">{pagination.total}</span>
                            </div>
                        </div>
                        <div>
                            <div className="dash-stat-label">Errors</div>
                            <div style={{ fontSize: 14 }}>
                                {errors.length > 0 ? (
                                    <span className="dash-badge dash-badge-bounce">{errors.length}</span>
                                ) : (
                                    <span style={{ color: "var(--dash-text-dim)" }}>None</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                <button
                    className={`dash-btn ${tab === "messages" ? "dash-btn-primary" : "dash-btn-ghost"}`}
                    onClick={() => setTab("messages")}
                >
                    Messages ({pagination.total})
                </button>
                <button
                    className={`dash-btn ${tab === "errors" ? "dash-btn-primary" : "dash-btn-ghost"}`}
                    onClick={() => setTab("errors")}
                >
                    Errors ({errors.length})
                </button>
            </div>

            {/* Tab Content */}
            <div className="dash-section">
                {tab === "messages" ? (
                    <>
                        <div className="dash-section-body">
                            {messages.length === 0 ? (
                                <div className="dash-empty">
                                    <div className="dash-empty-text">No messages in this batch</div>
                                </div>
                            ) : (
                                <div className="dash-table-wrap">
                                    <table className="dash-table">
                                        <thead>
                                            <tr>
                                                <th>Message ID</th>
                                                <th>To</th>
                                                <th>Events</th>
                                                <th>Created</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {messages.map((msg) => (
                                                <tr key={msg.id}>
                                                    <td className="dash-table-mono" title={msg.messageId}>
                                                        {msg.messageId.length > 24 ? msg.messageId.slice(0, 24) + "…" : msg.messageId}
                                                    </td>
                                                    <td>{msg.toEmail}</td>
                                                    <td>
                                                        <span className="dash-badge dash-badge-default">{msg.eventCount}</span>
                                                    </td>
                                                    <td>{new Date(msg.created).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        {pagination.totalPages > 1 && (
                            <div className="dash-pagination">
                                <span>
                                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                </span>
                                <div className="dash-pagination-buttons">
                                    <button className="dash-pagination-btn" disabled={pagination.page <= 1} onClick={() => fetchData(pagination.page - 1)}>
                                        ← Prev
                                    </button>
                                    <button className="dash-pagination-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchData(pagination.page + 1)}>
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="dash-section-body">
                        {errors.length === 0 ? (
                            <div className="dash-empty">
                                <div className="dash-empty-icon">✅</div>
                                <div className="dash-empty-text">No errors for this batch</div>
                            </div>
                        ) : (
                            <div className="dash-table-wrap">
                                <table className="dash-table">
                                    <thead>
                                        <tr>
                                            <th>Message ID</th>
                                            <th>To</th>
                                            <th>Error</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {errors.map((err) => (
                                            <tr key={err.id}>
                                                <td className="dash-table-mono" title={err.messageId}>
                                                    {err.messageId.length > 24 ? err.messageId.slice(0, 24) + "…" : err.messageId}
                                                </td>
                                                <td>{err.toEmail}</td>
                                                <td style={{ whiteSpace: "normal", maxWidth: 400, color: "var(--dash-error)" }}>
                                                    {err.error.length > 100 ? err.error.slice(0, 100) + "…" : err.error}
                                                </td>
                                                <td>{new Date(err.created).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
