import { cookies } from "next/headers"
import { prisma } from "@/lib/database"

const COOKIE_NAME = "dashboard_token"
const JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "mailgun-ses-proxy-dashboard-secret-change-me"
const SESSION_DURATION = 24 * 60 * 60 // 24 hours in seconds

// --- Password Hashing (PBKDF2 via Web Crypto) ---

const ITERATIONS = 100_000
const KEY_LENGTH = 64
const HASH_ALGORITHM = "SHA-512"

async function derivePBKDF2(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    )
    return crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: HASH_ALGORITHM },
        keyMaterial,
        KEY_LENGTH * 8
    )
}

function bufToHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}

function hexToBuf(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const derived = await derivePBKDF2(password, salt)
    return `${bufToHex(salt.buffer as ArrayBuffer)}:${bufToHex(derived)}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [saltHex, hashHex] = storedHash.split(":")
    if (!saltHex || !hashHex) return false
    const salt = hexToBuf(saltHex)
    const derived = await derivePBKDF2(password, salt)
    const derivedHex = bufToHex(derived)
    // Constant-time comparison
    if (derivedHex.length !== hashHex.length) return false
    let mismatch = 0
    for (let i = 0; i < derivedHex.length; i++) {
        mismatch |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
    }
    return mismatch === 0
}

// --- JWT Session (HMAC-SHA256 via Web Crypto) ---

async function getSigningKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    )
}

function base64UrlEncode(data: string | ArrayBuffer): string {
    const str = typeof data === "string"
        ? btoa(data)
        : btoa(String.fromCharCode(...new Uint8Array(data)))
    return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(str: string): string {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/")
    return atob(padded)
}

interface JWTPayload {
    sub: string
    email: string
    name: string
    iat: number
    exp: number
}

export async function createSession(userId: string, email: string, name: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const payload: JWTPayload = {
        sub: userId,
        email,
        name: name || email,
        iat: now,
        exp: now + SESSION_DURATION,
    }

    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const body = base64UrlEncode(JSON.stringify(payload))
    const signingInput = `${header}.${body}`

    const key = await getSigningKey()
    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput))

    return `${signingInput}.${base64UrlEncode(signature)}`
}

export async function verifySession(token: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split(".")
        if (parts.length !== 3) return null

        const signingInput = `${parts[0]}.${parts[1]}`
        const signature = Uint8Array.from(base64UrlDecode(parts[2]), (c) => c.charCodeAt(0))

        const key = await getSigningKey()
        const encoder = new TextEncoder()
        const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(signingInput))
        if (!valid) return null

        const payload: JWTPayload = JSON.parse(base64UrlDecode(parts[1]))
        if (payload.exp < Math.floor(Date.now() / 1000)) return null

        return payload
    } catch {
        return null
    }
}

export async function getSessionFromCookies(): Promise<JWTPayload | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return verifySession(token)
}

export function setSessionCookie(response: Response, token: string): void {
    response.headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}`
    )
}

export function clearSessionCookie(response: Response): void {
    response.headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=0`
    )
}

// --- User Management ---

export async function ensureDefaultUser() {
    const count = await prisma.dashboardUser.count()
    if (count === 0) {
        const hash = await hashPassword("admin")
        await prisma.dashboardUser.create({
            data: {
                email: "admin@localhost",
                password: hash,
                name: "Admin",
            },
        })
    }
}
