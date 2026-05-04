"use client"
import React from "react"
import { useScannerEvents } from "@/hooks/use-scanner-events"

export default function Template({ children }: { children: React.ReactNode }) {
    useScannerEvents()
    return <>{children}</>
}
