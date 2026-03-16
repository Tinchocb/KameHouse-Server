import { Button } from "@/components/ui/button/button"
import { cn } from "@/components/ui/core/styling"
import { useRouter } from "@/lib/navigation"
import React from "react"

interface BulmaErrorProps {
    children?: React.ReactNode
    className?: string
    reset?: () => void
    title?: string | null
    showRefreshButton?: boolean
    imageContainerClass?: string
    imagePath?: string
}

export const BulmaError: React.FC<BulmaErrorProps> = (props) => {

    const { children, reset, className, title = "Oops!", showRefreshButton = false, imageContainerClass, imagePath = "/bulma-not-found.png", ...rest } = props

    const router = useRouter()


    return (
        <>
            <div data-bulma-error className={cn("w-full flex flex-col items-center mt-10 space-y-4", className)}>
                {<div
                    data-bulma-error-image-container
                    className={cn("size-[8rem] mx-auto flex-none rounded-[--radius-md] object-cover object-center relative overflow-hidden",
                        imageContainerClass)}
                >
                    <img
                        data-bulma-error-image
                        src={imagePath}
                        alt={""}
                        className="w-full h-full object-contain object-top"
                    />
                </div>}
                <div data-bulma-error-content className="text-center space-y-4">
                    {!!title && <h3 data-bulma-error-title>{title}</h3>}
                    <div data-bulma-error-content-children>{children}</div>
                    <div data-bulma-error-content-buttons>
                        {(showRefreshButton && !reset) && (
                            <Button data-bulma-error-content-button-refresh intent="warning-subtle" onClick={() => router.refresh()}>Retry</Button>
                        )}
                        {!!reset && (
                            <Button data-bulma-error-content-button-reset intent="warning-subtle" onClick={reset}>Retry</Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )

}
