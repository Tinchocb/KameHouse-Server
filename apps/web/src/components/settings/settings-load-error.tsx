import { Button } from "@/components/ui/button"

/**
 * Ajustes no pudo cargar la configuración del servidor. No se muestra el formulario con valores por
 * defecto: se verían como si fueran los del usuario, y Guardar o Descartar los escribirían (QA-01).
 */
export function SettingsLoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
            <h2 className="text-lg font-semibold text-on-surface">No se pudieron cargar los ajustes</h2>
            <p className="max-w-md text-sm text-on-surface-variant">
                El servidor no respondió. Los valores de fábrica no se muestran como si fueran los tuyos.
            </p>
            <Button intent="primary" size="md" onClick={onRetry}>
                Reintentar
            </Button>
        </div>
    )
}
