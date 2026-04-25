"use client"

import { useState, useEffect } from "react"

interface Setting {
    key: string
    label: string
    type: string
    value: string
    source: "database" | "environment"
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Setting[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
    const [dirty, setDirty] = useState(false)

    useEffect(() => {
        fetch("/dashboard/api/settings")
            .then((r) => r.json())
            .then((data) => setSettings(data.settings || []))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleChange = (key: string, value: string) => {
        setSettings((prev) =>
            prev.map((s) => (s.key === key ? { ...s, value, source: "database" as const } : s))
        )
        setDirty(true)
    }

    const handleToggle = (key: string) => {
        setSettings((prev) =>
            prev.map((s) => {
                if (s.key === key) {
                    const newVal = s.value === "true" || s.value === "1" ? "false" : "true"
                    return { ...s, value: newVal, source: "database" as const }
                }
                return s
            })
        )
        setDirty(true)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/dashboard/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings: settings.map((s) => ({ key: s.key, value: s.value })),
                }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(`✅ Settings saved (${data.updated} updated)`, "success")
                setDirty(false)
                // Reload to get fresh source info
                const fresh = await fetch("/dashboard/api/settings")
                const freshData = await fresh.json()
                setSettings(freshData.settings || [])
            } else {
                showToast(`❌ ${data.error || "Failed to save"}`, "error")
            }
        } catch {
            showToast("❌ Network error", "error")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="dash-loading"><div className="dash-spinner" /></div>
    }

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h1 className="dash-page-title">Settings</h1>
                    <p className="dash-page-desc" style={{ marginBottom: 0 }}>
                        Manage application configuration. Changes are stored in the database and override environment variables.
                    </p>
                </div>
                <button
                    className="dash-btn dash-btn-primary"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="dash-section">
                <div className="dash-section-header">
                    <div className="dash-section-title">⚙️ Application Configuration</div>
                </div>
                <div className="dash-settings-list">
                    {settings.map((setting) => (
                        <div key={setting.key} className="dash-settings-row">
                            <div className="dash-settings-label">
                                <div className="dash-settings-key">{setting.label}</div>
                                <div className="dash-settings-desc" style={{ fontFamily: "monospace" }}>{setting.key}</div>
                            </div>

                            {setting.type === "boolean" ? (
                                <label className="dash-toggle">
                                    <input
                                        type="checkbox"
                                        checked={setting.value === "true" || setting.value === "1"}
                                        onChange={() => handleToggle(setting.key)}
                                    />
                                    <span className="dash-toggle-slider" />
                                </label>
                            ) : (
                                <input
                                    className="dash-settings-input"
                                    value={setting.value}
                                    onChange={(e) => handleChange(setting.key, e.target.value)}
                                    placeholder={`Enter ${setting.label.toLowerCase()}`}
                                />
                            )}

                            <span className={`dash-settings-source ${setting.source === "database" ? "dash-settings-source-db" : "dash-settings-source-env"}`}>
                                {setting.source === "database" ? "DB" : "ENV"}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="dash-section" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>💡</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--dash-text)", marginBottom: 4 }}>
                            About Settings Sources
                        </div>
                        <div style={{ fontSize: 12, color: "var(--dash-text-dim)", lineHeight: 1.6 }}>
                            <strong style={{ color: "var(--dash-success)" }}>DB</strong> — Value stored in database, overrides the environment variable.<br />
                            <strong style={{ color: "var(--dash-info)" }}>ENV</strong> — Value read from the environment variable. Saving will store it in the database.<br />
                            <em>Note: Some settings may require a server restart to take effect.</em>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`dash-toast ${toast.type === "success" ? "dash-toast-success" : "dash-toast-error"}`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}
