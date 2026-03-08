export function useGetStatus() { return { data: null } }
export function useGetLogFilenames() { return { data: [] } }
export function useDeleteLogs() { return { mutate: () => { } } }
export function useGetLatestLogContent() { return { mutate: () => { } } }
export function useGetAnnouncements() { return { mutate: () => { } } }
export function useGetMemoryStats() { return { data: null } }
export function useForceGC() { return { mutate: () => { } } }
export function useDownloadMemoryProfile() { return { mutate: () => { } } }
export function useDownloadGoRoutineProfile() { return { mutate: () => { } } }
export function useDownloadCPUProfile() { return { mutate: () => { } } }
export function useGetHomeItems() { return { data: [] } }
export function useUpdateHomeItems() { return { mutate: () => { } } }
