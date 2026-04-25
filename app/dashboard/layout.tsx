"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Activity, ChevronRight, LayoutDashboard, LogOut, Mail, Menu, Settings } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import "./dashboard.css"
import { SessionContext, UserSession } from "./session-context"

const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/newsletters", label: "Newsletters", icon: Mail },
    { href: "/dashboard/events", label: "Events", icon: Activity },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [session, setSession] = useState<UserSession | null>(null)

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
        } catch {
            /* ignore */
        }
    }, [pathname])

    const handleLogout = async () => {
        await fetch("/dashboard/api/logout", { method: "POST" })
        router.push("/dashboard/login")
    }

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard"
        return pathname.startsWith(href)
    }

    if (pathname === "/dashboard/login") {
        return <>{children}</>
    }

    return (
        <SessionContext.Provider value={session}>
            <div className="flex h-screen overflow-hidden bg-background">
                {/* Mobile Sidebar Overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* Sidebar */}
                <aside
                    className={cn(
                        "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    )}
                >
                    <div className="flex h-full flex-col">
                        <div className="flex h-16 items-center px-6 border-b">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold mr-3">
                                M
                            </div>
                            <div>
                                <div className="text-sm font-bold leading-none">Mailgun → SES</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                                    Admin Dashboard
                                </div>
                            </div>
                        </div>

                        <nav className="flex-1 space-y-1 p-4">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const active = isActive(item.href)
                                return (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                                            active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                                        )}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            setSidebarOpen(false)
                                            router.push(item.href)
                                        }}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                        {active && <ChevronRight className="ml-auto h-4 w-4" />}
                                    </a>
                                )
                            })}
                        </nav>

                        <div className="mt-auto border-t p-4">
                            <div className="flex items-center gap-3 px-2 py-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-20 text-muted-foreground hover:text-destructive"
                                    onClick={handleLogout}
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4 mr-2" /> logout
                                </Button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <header className="flex h-16 items-center justify-between border-b bg-card/50 backdrop-blur px-6 lg:justify-end">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        <div className="hidden lg:flex flex-1 items-center font-medium">
                            {navItems.find((n) => isActive(n.href))?.label || "Dashboard"}
                        </div>

                        <div className="text-xs text-muted-foreground">
                            {new Date().toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                            })}
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="mx-auto max-w-6xl">{children}</div>
                    </main>
                </div>
            </div>
        </SessionContext.Provider>
    )
}
