import { IconUiAlert, IconUiRefresh, IconUiClose } from "@/components/ui/icons";
import * as React from "react"
import { Button } from "@/components/ui/button"


interface Props {
    children: React.ReactNode
    /** Optional label shown in the fallback — e.g. "El reproductor" */
    label?: string
    /** Optional close callback to exit fullscreen player upon unrecoverable errors */
    onClose?: () => void
}

interface State {
    hasError: boolean
}

/**
 * PlayerErrorBoundary — wraps the video player to isolate render crashes.
 *
 * A crash inside the player (e.g. a corrupt subtitle track, a bad chapter
 * timestamp, or an unexpected null ref in a hook) would normally propagate
 * to the nearest parent boundary and potentially unmount the entire app.
 * This boundary catches those errors and shows a retry UI instead.
 */
export class PlayerErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo) {
        console.error("[PlayerErrorBoundary] Player crashed:", error, info.componentStack)
    }

    private handleRetry = () => {
        this.setState({ hasError: false })
    }

    render() {
        if (this.state.hasError) {
            const { label = "El reproductor", onClose } = this.props
            return (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/80 text-label-1 rounded-lg p-8 min-h-[200px]">
                    <IconUiAlert className="w-10 h-10 text-brand-warning shrink-0" />
                    <div className="text-center space-y-1">
                        <h3 className="font-semibold text-base text-balance">{label} encontró un error</h3>
                        <p className="text-sm text-label-2">No pudimos continuar la reproducción. Intentá de nuevo o cerrá el reproductor y abrí otro video.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            intent="glass"
                            size="md"
                            onClick={this.handleRetry}
                            leftIcon={<IconUiRefresh className="w-4 h-4" />}
                            iconSpacing="0.5rem"
                        >
                            Reintentar
                        </Button>
                        {onClose && (
                            <Button
                                intent="destructive"
                                size="md"
                                onClick={onClose}
                                leftIcon={<IconUiClose className="w-4 h-4" />}
                                iconSpacing="0.5rem"
                            >
                                Cerrar reproductor
                            </Button>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
