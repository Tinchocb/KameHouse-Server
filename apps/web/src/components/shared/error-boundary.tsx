import * as React from "react"
import { AlertTriangle } from "lucide-react"

interface Props {
    children: React.ReactNode
    fallback?: React.ReactNode
    className?: string
}

interface State {
    hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
    }

    public static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className={this.props.className}>
                        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
                            <AlertTriangle className="h-5 w-5" />
                            <span className="text-sm font-medium">No se pudo cargar esta sección.</span>
                        </div>
                    </div>
                )
            )
        }

        return this.props.children
    }
}
