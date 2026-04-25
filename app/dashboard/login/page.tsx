"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/dashboard/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Login failed")
                return
            }

            router.push("/dashboard")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="dash-login-page">
            <div className="dash-login-bg" />
            <div className="dash-login-card">
                <div className="dash-login-logo">
                    <div className="dash-logo-icon" style={{ width: 40, height: 40, fontSize: 18 }}>M</div>
                </div>
                <h1 className="dash-login-title">Welcome back</h1>
                <p className="dash-login-subtitle">Sign in to your dashboard</p>

                {error && <div className="dash-login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="dash-form-group">
                        <label className="dash-form-label" htmlFor="login-email">Email</label>
                        <input
                            id="login-email"
                            className="dash-form-input"
                            type="email"
                            placeholder="admin@localhost"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="dash-form-group">
                        <label className="dash-form-label" htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            className="dash-form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="dash-btn dash-btn-primary dash-login-btn"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--dash-text-dim)" }}>
                    Mailgun → SES Proxy Dashboard
                </p>
            </div>
        </div>
    )
}
