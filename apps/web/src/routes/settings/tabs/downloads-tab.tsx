import React from "react"
import { TabsContent } from "@/components/ui/tabs/tabs"
import { Section, Card, OsToggle, OsInput, OsSelect } from "../components"
import { type Control, useWatch } from "react-hook-form"
import { type SettingsFormValues } from "../index"
import { motion, AnimatePresence } from "framer-motion"

export function DownloadsTab({ control }: { control: Control<SettingsFormValues> }) {
    const defaultTorrentClient = useWatch({ control, name: "torrent.defaultTorrentClient" })

    return (
        <TabsContent value="downloads" className="m-0 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 outline-none">
            {/* ── Header ── */}
            <header className="space-y-2">
                <h1 className="text-5xl font-black tracking-wider text-white font-bebas leading-none">
                    MOTOR DE <span className="text-zinc-500">DESCARGAS & TORRENT</span>
                </h1>
                <p className="text-zinc-400 text-base font-medium leading-relaxed max-w-3xl">
                    Administra tus descargas en segundo plano y el motor de streaming P2P (Peer-to-Peer).
                </p>
            </header>

            {/* ── 1. Torrent Streaming ── */}
            <Section label="Streaming P2P Directo">
                <Card>
                    <OsToggle
                        control={control}
                        name="torrentstream.enabled"
                        label="Habilitar Streaming de Torrents"
                        desc="Permite reproducir videos directamente desde redes Torrent en tiempo real (direct-play)."
                    />
                    <OsInput
                        control={control}
                        name="torrentstream.torrentioUrl"
                        label="Instancia de Torrentio / Addon"
                        desc="URL de la API proveedora de torrents compatible con Stremio (dejar en blanco para usar por defecto)."
                        placeholder="Ej. https://torrentio.strem.fun"
                        isMono
                    />
                </Card>
            </Section>

            {/* ── 2. Torrent Client Selection ── */}
            <Section label="Cliente Torrent Externo">
                <Card>
                    <OsSelect
                        control={control}
                        name="torrent.defaultTorrentClient"
                        label="Cliente de Torrent Predeterminado"
                        desc="El gestor externo que KameHouse utilizará para añadir y monitorizar descargas locales."
                        options={[
                            { value: "", label: "Ninguno (Desactivado)" },
                            { value: "qbittorrent", label: "qBittorrent" },
                            { value: "transmission", label: "Transmission" },
                        ]}
                    />
                </Card>
            </Section>

            {/* ── 3. Conditional Client Credentials ── */}
            <AnimatePresence mode="wait">
                {defaultTorrentClient === "qbittorrent" && (
                    <motion.div
                        key="qbittorrent"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Section label="Conexión de qBittorrent">
                            <Card>
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentHost"
                                    label="Host / IP del Cliente"
                                    desc="Dirección del panel web de control de qBittorrent."
                                    placeholder="Ej. http://127.0.0.1 o http://192.168.1.50"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentPort"
                                    label="Puerto de qBittorrent"
                                    desc="Puerto de la Web UI del cliente de qBittorrent."
                                    type="number"
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentUsername"
                                    label="Usuario"
                                    desc="Nombre de usuario del panel web de qBittorrent."
                                    placeholder="admin"
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentPassword"
                                    label="Contraseña"
                                    desc="Clave de acceso al panel web de qBittorrent."
                                    placeholder="Ingresa tu contraseña"
                                    isSecure
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentPath"
                                    label="Ruta de Almacenamiento Local"
                                    desc="Directorio físico en el servidor donde qBittorrent descargará los archivos."
                                    placeholder="Ej. D:\Downloads\Anime o /var/lib/transmission/downloads"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentCategory"
                                    label="Categoría por Defecto"
                                    desc="Asignar automáticamente una categoría a los torrents agregados."
                                    placeholder="kamehouse"
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.qbittorrentTags"
                                    label="Etiquetas del Torrent"
                                    desc="Etiquetas que se inyectarán a cada descarga agregada por KameHouse."
                                    placeholder="kamehouse-stream"
                                />
                            </Card>
                        </Section>
                    </motion.div>
                )}

                {defaultTorrentClient === "transmission" && (
                    <motion.div
                        key="transmission"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Section label="Conexión de Transmission">
                            <Card>
                                <OsInput
                                    control={control}
                                    name="torrent.transmissionHost"
                                    label="Host / IP del Cliente"
                                    desc="Dirección del servidor RPC de Transmission."
                                    placeholder="Ej. http://127.0.0.1 o http://192.168.1.55"
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.transmissionPort"
                                    label="Puerto de Transmission"
                                    desc="Puerto por defecto RPC de Transmission (usualmente 9091)."
                                    type="number"
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.transmissionUsername"
                                    label="Usuario"
                                    desc="Usuario RPC del panel de control de Transmission."
                                    placeholder="transmission"
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.transmissionPassword"
                                    label="Contraseña"
                                    desc="Contraseña RPC de Transmission."
                                    placeholder="Ingresa tu contraseña"
                                    isSecure
                                    isMono
                                />
                                <OsInput
                                    control={control}
                                    name="torrent.transmissionPath"
                                    label="Ruta de Descarga Local"
                                    desc="Directorio físico en el servidor donde se guardarán los archivos."
                                    placeholder="Ej. /var/lib/transmission-daemon/downloads"
                                    isMono
                                />
                            </Card>
                        </Section>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 4. Extras ── */}
            <Section label="Interfaz & Notificaciones del Gestor">
                <Card>
                    <OsToggle
                        control={control}
                        name="torrent.showActiveTorrentCount"
                        label="Mostrar Conteo de Torrents Activos"
                        desc="Mostrar un indicador con el número de descargas activas en la barra de navegación superior."
                    />
                    <OsToggle
                        control={control}
                        name="torrent.hideTorrentList"
                        label="Ocultar Descargas Finalizadas"
                        desc="Filtrar y ocultar de la lista principal los torrents que ya han completado su descarga."
                    />
                </Card>
            </Section>
        </TabsContent>
    )
}
