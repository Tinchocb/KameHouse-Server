import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"

export function NotFound() {
    return (
        <div className="sectionbar flex flex-col items-center justify-center min-h-[360px] max-w-lg mx-auto my-12 p-8 md:p-12 text-center animate-slide-up">
            <h2 className="text-3xl md:text-4xl font-display tracking-widest text-white mb-4 uppercase text-balance">
                PÁGINA NO ENCONTRADA
            </h2>
            <p className="text-on-surface-variant mb-8 leading-relaxed text-sm max-w-md font-medium text-pretty">
                El módulo que buscas no existe en este sector del universo.
            </p>
            <Link to="/home">
                <Button className="px-8 py-3 bg-brand-accent text-on-primary font-display font-black text-xs uppercase tracking-widest [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:scale-95 transition-[transform,filter] duration-base ease-smooth-out rounded-full h-auto shadow-brand-primary cursor-pointer">
                    VOLVER AL INICIO
                </Button>
            </Link>
        </div>
    )
}
