"use client"

import { useState, useEffect } from "react"

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
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="dash-empty">
                <div className="dash-empty-icon">⚠️</div>
                <div className="dash-empty-text">Failed to load dashboard stats</div>
            </div>
        )
    }

    const statCards = [
        { label: "Total Batches", value: stats.overview.totalBatches.toLocaleString(), className: "dash-stat-accent" },
        { label: "Messages Sent", value: stats.overview.totalMessages.toLocaleString(), className: "dash-stat-accent" },
        { label: "Delivery Rate", value: `${stats.overview.deliveryRate}%`, className: "dash-stat-success" },
        { label: "Total Errors", value: stats.overview.totalErrors.toLocaleString(), className: "dash-stat-error" },
        { label: "Bounced", value: stats.overview.totalBounced.toLocaleString(), className: "dash-stat-warning" },
        { label: "Complaints", value: stats.overview.totalComplaints.toLocaleString(), className: "dash-stat-error" },
    ]

    const activityCards = [
        { label: "Today", value: stats.activity.today },
        { label: "This Week", value: stats.activity.thisWeek },
        { label: "This Month", value: stats.activity.thisMonth },
    ]

    return (
        <div>
            <h1 className="dash-page-title">Dashboard Overview</h1>
            <p className="dash-page-desc">Monitor your email sending infrastructure at a glance</p>

            {/* Stat Cards */}
            <div className="dash-stats-grid">
                {statCards.map((card) => (
                    <div key={card.label} className="dash-stat-card">
                        <div className="dash-stat-label">{card.label}</div>
                        <div className={`dash-stat-value ${card.className}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Activity Summary */}
            <div className="dash-section">
                <div className="dash-section-header">
                    <div className="dash-section-title">📊 Sending Activity</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
                    {activityCards.map((a) => (
                        <div key={a.label} style={{ padding: "20px", textAlign: "center", borderRight: "1px solid var(--dash-border)" }}>
                            <div className="dash-stat-label">{a.label}</div>
                            <div className="dash-stat-value" style={{ fontSize: 24 }}>{a.value.toLocaleString()}</div>
                            <div className="dash-stat-sub">messages sent</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Batches */}
            <div className="dash-section">
                <div className="dash-section-header">
                    <div className="dash-section-title">📬 Recent Batches</div>
                    <a
                        href="/dashboard/newsletters"
                        className="dash-btn dash-btn-ghost"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                    >
                        View All →
                    </a>
                </div>
                <div className="dash-section-body">
                    {stats.recentBatches.length === 0 ? (
                        <div className="dash-empty">
                            <div className="dash-empty-icon">📭</div>
                            <div className="dash-empty-text">No newsletter batches yet</div>
                        </div>
                    ) : (
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Site</th>
                                        <th>From</th>
                                        <th>Messages</th>
                                        <th>Errors</th>
                                        <th>Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentBatches.map((batch) => (
                                        <tr key={batch.id}>
                                            <td className="dash-table-mono">{batch.batchId.slice(0, 16)}…</td>
                                            <td>{batch.siteId}</td>
                                            <td>{batch.fromEmail.length > 30 ? batch.fromEmail.slice(0, 30) + "…" : batch.fromEmail}</td>
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
            </div>
        </div>
    )
}
