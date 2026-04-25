"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import "./dashboard.css"
import { UserSession, SessionContext } from "./session-context"

// SVG Icons as components
const Icons = {
    dashboard: (
        <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    newsletters: (
        <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
        </svg>
    ),
    events: (
        <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    settings: (
        <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    menu: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    ),
    logout: (
        <svg className="dash-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
}

const navItems = [
    { href: "/dashboard", label: "Overview", icon: Icons.dashboard },
    { href: "/dashboard/newsletters", label: "Newsletters", icon: Icons.newsletters },
    { href: "/dashboard/events", label: "Events", icon: Icons.events },
    { href: "/dashboard/settings", label: "Settings", icon: Icons.settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [session, setSession] = useState<UserSession | null>(null)

    // Extract session from cookie (client-side decode, no verification)
    useEffect(() => {
        try {
            const cookies = document.cookie.split(";").map((c) => c.trim())
            const tokenCookie = cookies.find((c) => c.startsWith("dashboard_token="))
            if (tokenCookie) {
                const token = tokenCookie.split("=")[1]
                const parts = token.split(".")
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
                    setSession({ name: payload.name || payload.email, email: payload.email })
                }
            }
        } catch { /* ignore */ }
    }, [pathname])

    const handleLogout = async () => {
        await fetch("/dashboard/api/logout", { method: "POST" })
        router.push("/dashboard/login")
    }

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard"
        return pathname.startsWith(href)
    }

    // Don't render the shell for the login page
    if (pathname === "/dashboard/login") {
        return <>{children}</>
    }

    return (
        <SessionContext.Provider value={session}>
            <div className="dash-layout">
                {/* Overlay */}
                <div
                    className={`dash-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                />

                {/* Sidebar */}
                <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
                    <div className="dash-logo">
                        <div className="dash-logo-icon">M</div>
                        <div>
                            <div className="dash-logo-text">Mailgun → SES</div>
                            <div className="dash-logo-sub">Proxy Dashboard</div>
                        </div>
                    </div>

                    <nav className="dash-nav">
                        {navItems.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`dash-nav-link ${isActive(item.href) ? "active" : ""}`}
                                onClick={(e) => {
                                    e.preventDefault()
                                    setSidebarOpen(false)
                                    router.push(item.href)
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="dash-user">
                        <div className="dash-user-avatar">
                            {session?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="dash-user-info">
                            <div className="dash-user-name">{session?.name || "Loading..."}</div>
                            <div className="dash-user-email">{session?.email || ""}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="dash-btn-ghost"
                            style={{ padding: "6px", borderRadius: "6px", border: "none" }}
                            title="Logout"
                        >
                            {Icons.logout}
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <div className="dash-main">
                    <header className="dash-header">
                        <button className="dash-mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            {Icons.menu}
                        </button>
                        <div style={{ fontSize: "14px", fontWeight: 500 }}>
                            {navItems.find((n) => isActive(n.href))?.label || "Dashboard"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--dash-text-dim)" }}>
                            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                    </header>
                    <main className="dash-content">
                        {children}
                    </main>
                </div>
            </div>
        </SessionContext.Provider>
    )
}
