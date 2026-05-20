import React from 'react';
import { motion } from 'framer-motion';
import { Play, Film } from 'lucide-react'; // Ajusta los iconos a la librería que uses (lucide, heroicons, etc.)

interface HeroProps {
    bgImage: string;
    logoUrl: string;
    description: string;
    charactersImage?: string;
}

export const HeroSection: React.FC<HeroProps> = ({
    bgImage,
    logoUrl,
    description,
    charactersImage
}) => {
    return (
        // 1. h-screen hace que ocupe toda la pantalla. overflow-hidden evita scrollbars innecesarios
        <section className="relative w-full h-screen overflow-hidden bg-black text-white">

            {/* --- FONDO ANIMADO --- */}
            <motion.div
                initial={{ scale: 1.08, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute inset-0"
            >
                <img
                    src={bgImage}
                    alt="Fondo"
                    className="w-full h-full object-cover"
                />
            </motion.div>

            {/* --- GRADIENTES ESTILO STREAMING --- */}
            {/* Oscurece la izquierda para que el texto sea siempre legible */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent z-10" />
            {/* Oscurece la parte inferior para fusionarse con el resto de la app */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />

            {/* --- CONTENIDO PRINCIPAL (Texto y Botones) --- */}
            <div className="relative z-20 flex flex-col justify-center h-full px-6 md:px-16 lg:px-24 w-full max-w-3xl">

                {/* Logo de la serie */}
                <motion.img
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    src={logoUrl}
                    className="w-full max-w-[300px] md:max-w-[500px] mb-6 drop-shadow-2xl"
                    alt="Logo de la Serie"
                />

                {/* Sinopsis */}
                <motion.p
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="text-gray-200 text-base md:text-lg lg:text-xl line-clamp-3 md:line-clamp-4 mb-8 text-shadow-md max-w-2xl font-medium"
                >
                    {description}
                </motion.p>

                {/* Botones de Acción */}
                <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="flex flex-wrap items-center gap-4"
                >
                    <button className="flex items-center gap-2 bg-white text-black px-6 md:px-8 py-2 md:py-3 rounded-md font-bold text-lg hover:bg-white/80 transition-all hover:scale-105 active:scale-95 shadow-lg">
                        <Play className="w-6 h-6 fill-black" />
                        Reproducir
                    </button>

                    <button className="flex items-center gap-2 bg-gray-500/60 text-white px-6 md:px-8 py-2 md:py-3 rounded-md font-bold text-lg backdrop-blur-md hover:bg-gray-500/80 transition-all hover:scale-105 active:scale-95 shadow-lg">
                        <Film className="w-6 h-6" />
                        Tráiler
                    </button>
                </motion.div>
            </div>

            {/* --- PERSONAJES FLOTANTES (Animación Mejorada y Más Grandes) --- */}
            {charactersImage && (
                <motion.div
                    // Inicia fuera de la pantalla a la derecha, más pequeño y transparente
                    initial={{ x: 150, y: 50, opacity: 0, scale: 0.8 }}
                    // Entra y luego se queda flotando en el eje Y
                    animate={{
                        x: 0,
                        y: [0, -20, 0], // Movimiento de levitación constante
                        opacity: 1,
                        scale: 1.3 // Escala aumentada al 130% para que sean más grandes
                    }}
                    transition={{
                        x: { delay: 0.5, duration: 1.2, ease: "easeOut" },
                        opacity: { delay: 0.5, duration: 1.2 },
                        scale: { delay: 0.5, duration: 1.2, ease: "easeOut" },
                        // La levitación (eje Y) se repite infinitamente de forma suave
                        y: {
                            repeat: Infinity,
                            duration: 5,
                            ease: "easeInOut",
                            delay: 1.7
                        }
                    }}
                    className="absolute bottom-0 right-5 lg:right-20 z-20 hidden md:block origin-bottom-right"
                >
                    <img
                        src={charactersImage}
                        alt="Personajes"
                        className="h-[50vh] lg:h-[70vh] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
                        style={{ filter: 'brightness(1.1) contrast(1.1)' }} // Ligero realce para que destaquen más
                    />
                </motion.div>
            )}
        </section>
    );
};