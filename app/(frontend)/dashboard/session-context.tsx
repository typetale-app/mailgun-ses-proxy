"use client"

import { createContext, useContext } from "react"

export interface UserSession {
    name: string
    email: string
}

export const SessionContext = createContext<UserSession | null>(null)
export const useSession = () => useContext(SessionContext)
