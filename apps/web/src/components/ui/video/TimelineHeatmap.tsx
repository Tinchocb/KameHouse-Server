import React, { useMemo, useRef, useEffect } from "react"

interface TimelineHeatmapProps {
    duration: number
    data: number[] // Values between 0 and 1 representing intensity
    className?: string
}

export function TimelineHeatmap({ duration, data, className }: TimelineHeatmapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !data.length) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const { width, height } = canvas
        ctx.clearRect(0, 0, width, height)

        // Draw Heatmap
        const barWidth = width / data.length
        
        // Create Gradient for the heatmap
        const gradient = ctx.createLinearGradient(0, height, 0, 0)
        gradient.addColorStop(0, "rgba(255, 255, 255, 0)")
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.4)")

        ctx.fillStyle = gradient

        data.forEach((value, i) => {
            const barHeight = value * height
            ctx.beginPath()
            ctx.roundRect(i * barWidth, height - barHeight, barWidth - 1, barHeight, [2, 2, 0, 0])
            ctx.fill()
        })
    }, [data])

    if (!data.length) return null

    return (
        <canvas
            ref={canvasRef}
            width={1000}
            height={40}
            className={className}
            style={{ imageRendering: "pixelated" }}
        />
    )
}
