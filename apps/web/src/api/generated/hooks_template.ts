//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Platform
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetAnimeCollection() {
//     return useServerQuery<AL_AnimeCollection>({
//         endpoint: API_ENDPOINTS.Platform.GetAnimeCollection.endpoint,
//         method: API_ENDPOINTS.Platform.GetAnimeCollection.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetAnimeCollection.key],
//         enabled: true,
//     })
// }

// export function useGetAnimeCollection() {
//     return useServerMutation<AL_AnimeCollection>({
//         endpoint: API_ENDPOINTS.Platform.GetAnimeCollection.endpoint,
//         method: API_ENDPOINTS.Platform.GetAnimeCollection.methods[1],
//         mutationKey: [API_ENDPOINTS.Platform.GetAnimeCollection.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetRawAnimeCollection() {
//     return useServerQuery<AL_AnimeCollection>({
//         endpoint: API_ENDPOINTS.Platform.GetRawAnimeCollection.endpoint,
//         method: API_ENDPOINTS.Platform.GetRawAnimeCollection.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetRawAnimeCollection.key],
//         enabled: true,
//     })
// }

// export function useGetRawAnimeCollection() {
//     return useServerMutation<AL_AnimeCollection>({
//         endpoint: API_ENDPOINTS.Platform.GetRawAnimeCollection.endpoint,
//         method: API_ENDPOINTS.Platform.GetRawAnimeCollection.methods[1],
//         mutationKey: [API_ENDPOINTS.Platform.GetRawAnimeCollection.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useEditPlatformListEntry() {
//     return useServerMutation<true, EditPlatformListEntry_Variables>({
//         endpoint: API_ENDPOINTS.Platform.EditPlatformListEntry.endpoint,
//         method: API_ENDPOINTS.Platform.EditPlatformListEntry.methods[0],
//         mutationKey: [API_ENDPOINTS.Platform.EditPlatformListEntry.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetPlatformAnimeDetails(id: number) {
//     return useServerQuery<AL_AnimeDetailsById_Media>({
//         endpoint: API_ENDPOINTS.Platform.GetPlatformAnimeDetails.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.Platform.GetPlatformAnimeDetails.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetPlatformAnimeDetails.key],
//         enabled: true,
//     })
// }

// export function useGetPlatformStudioDetails(id: number) {
//     return useServerQuery<AL_StudioDetails>({
//         endpoint: API_ENDPOINTS.Platform.GetPlatformStudioDetails.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.Platform.GetPlatformStudioDetails.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetPlatformStudioDetails.key],
//         enabled: true,
//     })
// }

// export function useDeletePlatformListEntry() {
//     return useServerMutation<boolean, DeletePlatformListEntry_Variables>({
//         endpoint: API_ENDPOINTS.Platform.DeletePlatformListEntry.endpoint,
//         method: API_ENDPOINTS.Platform.DeletePlatformListEntry.methods[0],
//         mutationKey: [API_ENDPOINTS.Platform.DeletePlatformListEntry.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlatformListAnime() {
//     return useServerMutation<AL_ListAnime, PlatformListAnime_Variables>({
//         endpoint: API_ENDPOINTS.Platform.PlatformListAnime.endpoint,
//         method: API_ENDPOINTS.Platform.PlatformListAnime.methods[0],
//         mutationKey: [API_ENDPOINTS.Platform.PlatformListAnime.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlatformListRecentAiringAnime() {
//     return useServerMutation<AL_ListRecentAnime, PlatformListRecentAiringAnime_Variables>({
//         endpoint: API_ENDPOINTS.Platform.PlatformListRecentAiringAnime.endpoint,
//         method: API_ENDPOINTS.Platform.PlatformListRecentAiringAnime.methods[0],
//         mutationKey: [API_ENDPOINTS.Platform.PlatformListRecentAiringAnime.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlatformListMissedSequels() {
//     return useServerQuery<Array<AL_BaseAnime>>({
//         endpoint: API_ENDPOINTS.Platform.PlatformListMissedSequels.endpoint,
//         method: API_ENDPOINTS.Platform.PlatformListMissedSequels.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.PlatformListMissedSequels.key],
//         enabled: true,
//     })
// }

// export function useGetPlatformStats() {
//     return useServerQuery<AL_Stats>({
//         endpoint: API_ENDPOINTS.Platform.GetPlatformStats.endpoint,
//         method: API_ENDPOINTS.Platform.GetPlatformStats.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetPlatformStats.key],
//         enabled: true,
//     })
// }

// export function useGetPlatformCacheLayerStatus() {
//     return useServerQuery<boolean>({
//         endpoint: API_ENDPOINTS.Platform.GetPlatformCacheLayerStatus.endpoint,
//         method: API_ENDPOINTS.Platform.GetPlatformCacheLayerStatus.methods[0],
//         queryKey: [API_ENDPOINTS.Platform.GetPlatformCacheLayerStatus.key],
//         enabled: true,
//     })
// }

// export function useTogglePlatformCacheLayerStatus() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.Platform.TogglePlatformCacheLayerStatus.endpoint,
//         method: API_ENDPOINTS.Platform.TogglePlatformCacheLayerStatus.methods[0],
//         mutationKey: [API_ENDPOINTS.Platform.TogglePlatformCacheLayerStatus.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// anime
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetAnimeEpisodeCollection(id: number) {
//     return useServerQuery<Anime_EpisodeCollection>({
//         endpoint: API_ENDPOINTS.ANIME.GetAnimeEpisodeCollection.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.ANIME.GetAnimeEpisodeCollection.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME.GetAnimeEpisodeCollection.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// anime_collection
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetLibraryCollection() {
//     return useServerQuery<Anime_LibraryCollection>({
//         endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
//         method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
//         enabled: true,
//     })
// }

// export function useGetLibraryCollection() {
//     return useServerMutation<Anime_LibraryCollection>({
//         endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.endpoint,
//         method: API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.methods[1],
//         mutationKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetAnimeCollectionSchedule() {
//     return useServerQuery<Array<Anime_ScheduleItem>>({
//         endpoint: API_ENDPOINTS.ANIME_COLLECTION.GetAnimeCollectionSchedule.endpoint,
//         method: API_ENDPOINTS.ANIME_COLLECTION.GetAnimeCollectionSchedule.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetAnimeCollectionSchedule.key],
//         enabled: true,
//     })
// }

// export function useAddUnknownMedia() {
//     return useServerMutation<AL_AnimeCollection, AddUnknownMedia_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.endpoint,
//         method: API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_COLLECTION.AddUnknownMedia.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// anime_entries
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetAnimeEntry(id: number) {
//     return useServerQuery<Anime_Entry>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key],
//         enabled: true,
//     })
// }

// export function useAnimeEntryBulkAction() {
//     return useServerMutation<Array<Anime_LocalFile>, AnimeEntryBulkAction_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryBulkAction.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryBulkAction.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryBulkAction.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useOpenAnimeEntryInExplorer() {
//     return useServerMutation<boolean, OpenAnimeEntryInExplorer_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.OpenAnimeEntryInExplorer.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.OpenAnimeEntryInExplorer.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.OpenAnimeEntryInExplorer.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useFetchAnimeEntrySuggestions() {
//     return useServerMutation<Array<AL_BaseAnime>, FetchAnimeEntrySuggestions_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.FetchAnimeEntrySuggestions.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.FetchAnimeEntrySuggestions.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.FetchAnimeEntrySuggestions.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useAnimeEntryManualMatch() {
//     return useServerMutation<Array<Anime_LocalFile>, AnimeEntryManualMatch_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.AnimeEntryManualMatch.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetMissingEpisodes() {
//     return useServerQuery<Anime_MissingEpisodes>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key],
//         enabled: true,
//     })
// }

// export function useGetUpcomingEpisodes() {
//     return useServerQuery<Anime_UpcomingEpisodes>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetUpcomingEpisodes.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.GetUpcomingEpisodes.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetUpcomingEpisodes.key],
//         enabled: true,
//     })
// }

// export function useGetAnimeEntrySilenceStatus(id: number) {
//     return useServerQuery<Models_SilencedMediaEntry>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.methods[0],
//         queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntrySilenceStatus.key],
//         enabled: true,
//     })
// }

// export function useToggleAnimeEntrySilenceStatus() {
//     return useServerMutation<boolean, ToggleAnimeEntrySilenceStatus_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.ToggleAnimeEntrySilenceStatus.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.ToggleAnimeEntrySilenceStatus.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.ToggleAnimeEntrySilenceStatus.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateAnimeEntryProgress() {
//     return useServerMutation<boolean, UpdateAnimeEntryProgress_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateAnimeEntryRepeat() {
//     return useServerMutation<boolean, UpdateAnimeEntryRepeat_Variables>({
//         endpoint: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryRepeat.endpoint,
//         method: API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryRepeat.methods[0],
//         mutationKey: [API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryRepeat.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// auth
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useLogin() {
//     return useServerMutation<Status, Login_Variables>({
//         endpoint: API_ENDPOINTS.AUTH.Login.endpoint,
//         method: API_ENDPOINTS.AUTH.Login.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTH.Login.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLogout() {
//     return useServerMutation<Status>({
//         endpoint: API_ENDPOINTS.AUTH.Logout.endpoint,
//         method: API_ENDPOINTS.AUTH.Logout.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTH.Logout.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// auto_downloader
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useRunAutoDownloader() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloader.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloader.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloader.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRunAutoDownloaderSimulation() {
//     return useServerMutation<Array<AutoDownloader_SimulationResult>, RunAutoDownloaderSimulation_Variables>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloaderSimulation.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloaderSimulation.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.RunAutoDownloaderSimulation.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetAutoDownloaderRule(id: number) {
//     return useServerQuery<Anime_AutoDownloaderRule>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRule.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRule.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRule.key],
//         enabled: true,
//     })
// }

// export function useGetAutoDownloaderRulesByAnime(id: number) {
//     return useServerQuery<Array<Anime_AutoDownloaderRule>>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRulesByAnime.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRulesByAnime.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRulesByAnime.key],
//         enabled: true,
//     })
// }

// export function useGetAutoDownloaderRules() {
//     return useServerQuery<Array<Anime_AutoDownloaderRule>>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRules.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRules.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderRules.key],
//         enabled: true,
//     })
// }

// export function useCreateAutoDownloaderRule() {
//     return useServerMutation<Anime_AutoDownloaderRule, CreateAutoDownloaderRule_Variables>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderRule.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderRule.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderRule.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateAutoDownloaderRule() {
//     return useServerMutation<Anime_AutoDownloaderRule, UpdateAutoDownloaderRule_Variables>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderRule.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderRule.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderRule.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeleteAutoDownloaderRule(id: number) {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderRule.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderRule.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderRule.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetAutoDownloaderProfiles() {
//     return useServerQuery<Array<Anime_AutoDownloaderProfile>>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfiles.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfiles.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfiles.key],
//         enabled: true,
//     })
// }

// export function useGetAutoDownloaderProfile(id: number) {
//     return useServerQuery<Anime_AutoDownloaderProfile>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfile.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfile.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderProfile.key],
//         enabled: true,
//     })
// }

// export function useCreateAutoDownloaderProfile() {
//     return useServerMutation<Anime_AutoDownloaderProfile>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderProfile.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderProfile.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.CreateAutoDownloaderProfile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateAutoDownloaderProfile() {
//     return useServerMutation<Anime_AutoDownloaderProfile>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderProfile.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderProfile.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.UpdateAutoDownloaderProfile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeleteAutoDownloaderProfile(id: number) {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderProfile.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderProfile.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderProfile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetAutoDownloaderItems() {
//     return useServerQuery<Array<Models_AutoDownloaderItem>>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderItems.endpoint,
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderItems.methods[0],
//         queryKey: [API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderItems.key],
//         enabled: true,
//     })
// }

// export function useDeleteAutoDownloaderItem(id: number) {
//     return useServerMutation<boolean, DeleteAutoDownloaderItem_Variables>({
//         endpoint: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderItem.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderItem.methods[0],
//         mutationKey: [API_ENDPOINTS.AUTO_DOWNLOADER.DeleteAutoDownloaderItem.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// continuity
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useUpdateContinuityWatchHistoryItem() {
//     return useServerMutation<boolean, UpdateContinuityWatchHistoryItem_Variables>({
//         endpoint: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.endpoint,
//         method: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.methods[0],
//         mutationKey: [API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetContinuityWatchHistoryItem(id: number) {
//     return useServerQuery<Continuity_WatchHistoryItemResponse>({
//         endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.methods[0],
//         queryKey: [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.key],
//         enabled: true,
//     })
// }

// export function useGetContinuityWatchHistory() {
//     return useServerQuery<Continuity_WatchHistory>({
//         endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.endpoint,
//         method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.methods[0],
//         queryKey: [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// custom_source
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useCustomSourceListAnime() {
//     return useServerMutation<HibikeCustomSource_ListAnimeResponse, CustomSourceListAnime_Variables>({
//         endpoint: API_ENDPOINTS.CUSTOM_SOURCE.CustomSourceListAnime.endpoint,
//         method: API_ENDPOINTS.CUSTOM_SOURCE.CustomSourceListAnime.methods[0],
//         mutationKey: [API_ENDPOINTS.CUSTOM_SOURCE.CustomSourceListAnime.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// debrid
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetDebridSettings() {
//     return useServerQuery<Models_DebridSettings>({
//         endpoint: API_ENDPOINTS.DEBRID.GetDebridSettings.endpoint,
//         method: API_ENDPOINTS.DEBRID.GetDebridSettings.methods[0],
//         queryKey: [API_ENDPOINTS.DEBRID.GetDebridSettings.key],
//         enabled: true,
//     })
// }

// export function useSaveDebridSettings() {
//     return useServerMutation<Models_DebridSettings, SaveDebridSettings_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.SaveDebridSettings.endpoint,
//         method: API_ENDPOINTS.DEBRID.SaveDebridSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.SaveDebridSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridAddTorrents() {
//     return useServerMutation<boolean, DebridAddTorrents_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridAddTorrents.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridAddTorrents.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridAddTorrents.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridDownloadTorrent() {
//     return useServerMutation<boolean, DebridDownloadTorrent_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridDownloadTorrent.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridDownloadTorrent.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridDownloadTorrent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridCancelDownload() {
//     return useServerMutation<boolean, DebridCancelDownload_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridCancelDownload.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridCancelDownload.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridCancelDownload.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridDeleteTorrent() {
//     return useServerMutation<boolean, DebridDeleteTorrent_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridDeleteTorrent.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridDeleteTorrent.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridDeleteTorrent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridGetTorrents() {
//     return useServerQuery<Array<Debrid_TorrentItem>>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridGetTorrents.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridGetTorrents.methods[0],
//         queryKey: [API_ENDPOINTS.DEBRID.DebridGetTorrents.key],
//         enabled: true,
//     })
// }

// export function useDebridGetTorrentInfo() {
//     return useServerMutation<Debrid_TorrentInfo, DebridGetTorrentInfo_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridGetTorrentInfo.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridGetTorrentInfo.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridGetTorrentInfo.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridGetTorrentFilePreviews() {
//     return useServerMutation<Array<DebridClient_FilePreview>, DebridGetTorrentFilePreviews_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridGetTorrentFilePreviews.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridGetTorrentFilePreviews.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridGetTorrentFilePreviews.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridStartStream() {
//     return useServerMutation<boolean, DebridStartStream_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridStartStream.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridStartStream.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridStartStream.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDebridCancelStream() {
//     return useServerMutation<boolean, DebridCancelStream_Variables>({
//         endpoint: API_ENDPOINTS.DEBRID.DebridCancelStream.endpoint,
//         method: API_ENDPOINTS.DEBRID.DebridCancelStream.methods[0],
//         mutationKey: [API_ENDPOINTS.DEBRID.DebridCancelStream.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// directory_selector
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useDirectorySelector() {
//     return useServerMutation<DirectorySelectorResponse, DirectorySelector_Variables>({
//         endpoint: API_ENDPOINTS.DIRECTORY_SELECTOR.DirectorySelector.endpoint,
//         method: API_ENDPOINTS.DIRECTORY_SELECTOR.DirectorySelector.methods[0],
//         mutationKey: [API_ENDPOINTS.DIRECTORY_SELECTOR.DirectorySelector.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// directstream
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useDirectstreamPlayLocalFile() {
//     return useServerMutation<Mediastream_MediaContainer, DirectstreamPlayLocalFile_Variables>({
//         endpoint: API_ENDPOINTS.DIRECTSTREAM.DirectstreamPlayLocalFile.endpoint,
//         method: API_ENDPOINTS.DIRECTSTREAM.DirectstreamPlayLocalFile.methods[0],
//         mutationKey: [API_ENDPOINTS.DIRECTSTREAM.DirectstreamPlayLocalFile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDirectstreamConvertSubs() {
//     return useServerMutation<string, DirectstreamConvertSubs_Variables>({
//         endpoint: API_ENDPOINTS.DIRECTSTREAM.DirectstreamConvertSubs.endpoint,
//         method: API_ENDPOINTS.DIRECTSTREAM.DirectstreamConvertSubs.methods[0],
//         mutationKey: [API_ENDPOINTS.DIRECTSTREAM.DirectstreamConvertSubs.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// docs
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetDocs() {
//     return useServerQuery<Array<ApiDocsGroup>>({
//         endpoint: API_ENDPOINTS.DOCS.GetDocs.endpoint,
//         method: API_ENDPOINTS.DOCS.GetDocs.methods[0],
//         queryKey: [API_ENDPOINTS.DOCS.GetDocs.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// download
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useDownloadTorrentFile() {
//     return useServerMutation<boolean, DownloadTorrentFile_Variables>({
//         endpoint: API_ENDPOINTS.DOWNLOAD.DownloadTorrentFile.endpoint,
//         method: API_ENDPOINTS.DOWNLOAD.DownloadTorrentFile.methods[0],
//         mutationKey: [API_ENDPOINTS.DOWNLOAD.DownloadTorrentFile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDownloadRelease() {
//     return useServerMutation<DownloadReleaseResponse, DownloadRelease_Variables>({
//         endpoint: API_ENDPOINTS.DOWNLOAD.DownloadRelease.endpoint,
//         method: API_ENDPOINTS.DOWNLOAD.DownloadRelease.methods[0],
//         mutationKey: [API_ENDPOINTS.DOWNLOAD.DownloadRelease.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDownloadMacDenshiUpdate() {
//     return useServerMutation<DownloadReleaseResponse, DownloadMacDenshiUpdate_Variables>({
//         endpoint: API_ENDPOINTS.DOWNLOAD.DownloadMacDenshiUpdate.endpoint,
//         method: API_ENDPOINTS.DOWNLOAD.DownloadMacDenshiUpdate.methods[0],
//         mutationKey: [API_ENDPOINTS.DOWNLOAD.DownloadMacDenshiUpdate.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// explorer
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useOpenInExplorer() {
//     return useServerMutation<boolean, OpenInExplorer_Variables>({
//         endpoint: API_ENDPOINTS.EXPLORER.OpenInExplorer.endpoint,
//         method: API_ENDPOINTS.EXPLORER.OpenInExplorer.methods[0],
//         mutationKey: [API_ENDPOINTS.EXPLORER.OpenInExplorer.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// extensions
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useFetchExternalExtensionData() {
//     return useServerMutation<Extension_Extension, FetchExternalExtensionData_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.FetchExternalExtensionData.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.FetchExternalExtensionData.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.FetchExternalExtensionData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useInstallExternalExtension() {
//     return useServerMutation<ExtensionRepo_ExtensionInstallResponse, InstallExternalExtension_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.InstallExternalExtension.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useInstallExternalExtensionRepository() {
//     return useServerMutation<ExtensionRepo_RepositoryInstallResponse, InstallExternalExtensionRepository_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.InstallExternalExtensionRepository.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.InstallExternalExtensionRepository.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.InstallExternalExtensionRepository.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUninstallExternalExtension() {
//     return useServerMutation<boolean, UninstallExternalExtension_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.UninstallExternalExtension.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateExtensionCode() {
//     return useServerMutation<boolean, UpdateExtensionCode_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.UpdateExtensionCode.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.UpdateExtensionCode.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.UpdateExtensionCode.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useReloadExternalExtensions() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ReloadExternalExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ReloadExternalExtensions.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.ReloadExternalExtensions.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useReloadExternalExtension() {
//     return useServerMutation<boolean, ReloadExternalExtension_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ReloadExternalExtension.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ReloadExternalExtension.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.ReloadExternalExtension.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useListExtensionData() {
//     return useServerQuery<Array<Extension_Extension>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ListExtensionData.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ListExtensionData.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.ListExtensionData.key],
//         enabled: true,
//     })
// }

// export function useGetExtensionPayload() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetExtensionPayload.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetExtensionPayload.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.GetExtensionPayload.key],
//         enabled: true,
//     })
// }

// export function useListDevelopmentModeExtensions() {
//     return useServerQuery<Array<Extension_Extension>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ListDevelopmentModeExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ListDevelopmentModeExtensions.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.ListDevelopmentModeExtensions.key],
//         enabled: true,
//     })
// }

// export function useGetAllExtensions() {
//     return useServerMutation<ExtensionRepo_AllExtensions, GetAllExtensions_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetAllExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetAllExtensions.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.GetAllExtensions.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetExtensionUpdateData() {
//     return useServerQuery<Array<ExtensionRepo_UpdateData>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.key],
//         enabled: true,
//     })
// }


// export function useListOnlinestreamProviderExtensions() {
//     return useServerQuery<Array<ExtensionRepo_OnlinestreamProviderExtensionItem>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.key],
//         enabled: true,
//     })
// }

// export function useListAnimeTorrentProviderExtensions() {
//     return useServerQuery<Array<ExtensionRepo_AnimeTorrentProviderExtensionItem>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.key],
//         enabled: true,
//     })
// }

// export function useListCustomSourceExtensions() {
//     return useServerQuery<Array<ExtensionRepo_CustomSourceExtensionItem>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.key],
//         enabled: true,
//     })
// }

// export function useGetPluginSettings() {
//     return useServerQuery<ExtensionRepo_StoredPluginSettingsData>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetPluginSettings.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetPluginSettings.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.GetPluginSettings.key],
//         enabled: true,
//     })
// }

// export function useSetPluginSettingsPinnedTrays() {
//     return useServerMutation<boolean, SetPluginSettingsPinnedTrays_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.SetPluginSettingsPinnedTrays.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.SetPluginSettingsPinnedTrays.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.SetPluginSettingsPinnedTrays.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGrantPluginPermissions() {
//     return useServerMutation<boolean, GrantPluginPermissions_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GrantPluginPermissions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GrantPluginPermissions.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.GrantPluginPermissions.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRunExtensionPlaygroundCode() {
//     return useServerMutation<RunPlaygroundCodeResponse, RunExtensionPlaygroundCode_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.RunExtensionPlaygroundCode.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.RunExtensionPlaygroundCode.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.RunExtensionPlaygroundCode.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetExtensionUserConfig() {
//     return useServerQuery<ExtensionRepo_ExtensionUserConfig>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetExtensionUserConfig.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetExtensionUserConfig.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.GetExtensionUserConfig.key],
//         enabled: true,
//     })
// }

// export function useSaveExtensionUserConfig() {
//     return useServerMutation<boolean, SaveExtensionUserConfig_Variables>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.SaveExtensionUserConfig.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.SaveExtensionUserConfig.methods[0],
//         mutationKey: [API_ENDPOINTS.EXTENSIONS.SaveExtensionUserConfig.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetMarketplaceExtensions() {
//     return useServerQuery<Array<Extension_Extension>>({
//         endpoint: API_ENDPOINTS.EXTENSIONS.GetMarketplaceExtensions.endpoint,
//         method: API_ENDPOINTS.EXTENSIONS.GetMarketplaceExtensions.methods[0],
//         queryKey: [API_ENDPOINTS.EXTENSIONS.GetMarketplaceExtensions.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// filecache
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetFileCacheTotalSize() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.FILECACHE.GetFileCacheTotalSize.endpoint,
//         method: API_ENDPOINTS.FILECACHE.GetFileCacheTotalSize.methods[0],
//         queryKey: [API_ENDPOINTS.FILECACHE.GetFileCacheTotalSize.key],
//         enabled: true,
//     })
// }

// export function useRemoveFileCacheBucket() {
//     return useServerMutation<boolean, RemoveFileCacheBucket_Variables>({
//         endpoint: API_ENDPOINTS.FILECACHE.RemoveFileCacheBucket.endpoint,
//         method: API_ENDPOINTS.FILECACHE.RemoveFileCacheBucket.methods[0],
//         mutationKey: [API_ENDPOINTS.FILECACHE.RemoveFileCacheBucket.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetFileCacheMediastreamVideoFilesTotalSize() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.FILECACHE.GetFileCacheMediastreamVideoFilesTotalSize.endpoint,
//         method: API_ENDPOINTS.FILECACHE.GetFileCacheMediastreamVideoFilesTotalSize.methods[0],
//         queryKey: [API_ENDPOINTS.FILECACHE.GetFileCacheMediastreamVideoFilesTotalSize.key],
//         enabled: true,
//     })
// }

// export function useClearFileCacheMediastreamVideoFiles() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.FILECACHE.ClearFileCacheMediastreamVideoFiles.endpoint,
//         method: API_ENDPOINTS.FILECACHE.ClearFileCacheMediastreamVideoFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.FILECACHE.ClearFileCacheMediastreamVideoFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// library_explorer
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetLibraryExplorerFileTree() {
//     return useServerQuery<LibraryExplorer_FileTreeJSON>({
//         endpoint: API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.endpoint,
//         method: API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.methods[0],
//         queryKey: [API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key],
//         enabled: true,
//     })
// }

// export function useRefreshLibraryExplorerFileTree() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.endpoint,
//         method: API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.methods[0],
//         mutationKey: [API_ENDPOINTS.LIBRARY_EXPLORER.RefreshLibraryExplorerFileTree.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLoadLibraryExplorerDirectoryChildren() {
//     return useServerMutation<boolean, LoadLibraryExplorerDirectoryChildren_Variables>({
//         endpoint: API_ENDPOINTS.LIBRARY_EXPLORER.LoadLibraryExplorerDirectoryChildren.endpoint,
//         method: API_ENDPOINTS.LIBRARY_EXPLORER.LoadLibraryExplorerDirectoryChildren.methods[0],
//         mutationKey: [API_ENDPOINTS.LIBRARY_EXPLORER.LoadLibraryExplorerDirectoryChildren.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// local
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useSetOfflineMode() {
//     return useServerMutation<boolean, SetOfflineMode_Variables>({
//         endpoint: API_ENDPOINTS.LOCAL.SetOfflineMode.endpoint,
//         method: API_ENDPOINTS.LOCAL.SetOfflineMode.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.SetOfflineMode.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalGetTrackedMediaItems() {
//     return useServerQuery<Array<Local_TrackedMediaItem>>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalGetTrackedMediaItems.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalGetTrackedMediaItems.methods[0],
//         queryKey: [API_ENDPOINTS.LOCAL.LocalGetTrackedMediaItems.key],
//         enabled: true,
//     })
// }

// export function useLocalAddTrackedMedia() {
//     return useServerMutation<boolean, LocalAddTrackedMedia_Variables>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalAddTrackedMedia.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalAddTrackedMedia.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalAddTrackedMedia.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalRemoveTrackedMedia() {
//     return useServerMutation<boolean, LocalRemoveTrackedMedia_Variables>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalRemoveTrackedMedia.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalRemoveTrackedMedia.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalRemoveTrackedMedia.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalGetIsMediaTracked(id: number, type: string) {
//     return useServerQuery<boolean>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalGetIsMediaTracked.endpoint.replace("{id}", String(id)).replace("{type}", String(type)),
//         method: API_ENDPOINTS.LOCAL.LocalGetIsMediaTracked.methods[0],
//         queryKey: [API_ENDPOINTS.LOCAL.LocalGetIsMediaTracked.key],
//         enabled: true,
//     })
// }

// export function useLocalSyncData() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalSyncData.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalSyncData.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalSyncData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalGetSyncQueueState() {
//     return useServerQuery<Local_QueueState>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalGetSyncQueueState.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalGetSyncQueueState.methods[0],
//         queryKey: [API_ENDPOINTS.LOCAL.LocalGetSyncQueueState.key],
//         enabled: true,
//     })
// }

// export function useLocalSyncPlatformData() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalSyncPlatformData.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalSyncPlatformData.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalSyncPlatformData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalSetHasLocalChanges() {
//     return useServerMutation<boolean, LocalSetHasLocalChanges_Variables>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalSetHasLocalChanges.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalSetHasLocalChanges.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalSetHasLocalChanges.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalGetHasLocalChanges() {
//     return useServerQuery<boolean>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalGetHasLocalChanges.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalGetHasLocalChanges.methods[0],
//         queryKey: [API_ENDPOINTS.LOCAL.LocalGetHasLocalChanges.key],
//         enabled: true,
//     })
// }

// export function useLocalGetLocalStorageSize() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalGetLocalStorageSize.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalGetLocalStorageSize.methods[0],
//         queryKey: [API_ENDPOINTS.LOCAL.LocalGetLocalStorageSize.key],
//         enabled: true,
//     })
// }

// export function useLocalSyncSimulatedDataToPlatform() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.LOCAL.LocalSyncSimulatedDataToPlatform.endpoint,
//         method: API_ENDPOINTS.LOCAL.LocalSyncSimulatedDataToPlatform.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCAL.LocalSyncSimulatedDataToPlatform.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// localfiles
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetLocalFiles() {
//     return useServerQuery<Array<Anime_LocalFile>>({
//         endpoint: API_ENDPOINTS.LOCALFILES.GetLocalFiles.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.GetLocalFiles.methods[0],
//         queryKey: [API_ENDPOINTS.LOCALFILES.GetLocalFiles.key],
//         enabled: true,
//     })
// }

// export function useImportLocalFiles() {
//     return useServerMutation<boolean, ImportLocalFiles_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.ImportLocalFiles.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.ImportLocalFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.ImportLocalFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useLocalFileBulkAction() {
//     return useServerMutation<Array<Anime_LocalFile>, LocalFileBulkAction_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.LocalFileBulkAction.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateLocalFileData() {
//     return useServerMutation<Array<Anime_LocalFile>, UpdateLocalFileData_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.UpdateLocalFileData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useSuperUpdateLocalFiles() {
//     return useServerMutation<boolean, SuperUpdateLocalFiles_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.SuperUpdateLocalFiles.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.SuperUpdateLocalFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.SuperUpdateLocalFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useUpdateLocalFiles() {
//     return useServerMutation<boolean, UpdateLocalFiles_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.UpdateLocalFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeleteLocalFiles() {
//     return useServerMutation<boolean, DeleteLocalFiles_Variables>({
//         endpoint: API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.DeleteLocalFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRemoveEmptyDirectories() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.endpoint,
//         method: API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.methods[0],
//         mutationKey: [API_ENDPOINTS.LOCALFILES.RemoveEmptyDirectories.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// mal
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useMALAuth() {
//     return useServerMutation<MalAuthResponse, MALAuth_Variables>({
//         endpoint: API_ENDPOINTS.MAL.MALAuth.endpoint,
//         method: API_ENDPOINTS.MAL.MALAuth.methods[0],
//         mutationKey: [API_ENDPOINTS.MAL.MALAuth.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useEditMALListEntryProgress() {
//     return useServerMutation<boolean, EditMALListEntryProgress_Variables>({
//         endpoint: API_ENDPOINTS.MAL.EditMALListEntryProgress.endpoint,
//         method: API_ENDPOINTS.MAL.EditMALListEntryProgress.methods[0],
//         mutationKey: [API_ENDPOINTS.MAL.EditMALListEntryProgress.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useMALLogout() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.MAL.MALLogout.endpoint,
//         method: API_ENDPOINTS.MAL.MALLogout.methods[0],
//         mutationKey: [API_ENDPOINTS.MAL.MALLogout.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// manual_dump
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useTestDump() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.MANUAL_DUMP.TestDump.endpoint,
//         method: API_ENDPOINTS.MANUAL_DUMP.TestDump.methods[0],
//         mutationKey: [API_ENDPOINTS.MANUAL_DUMP.TestDump.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// mediaplayer
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useStartDefaultMediaPlayer() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.MEDIAPLAYER.StartDefaultMediaPlayer.endpoint,
//         method: API_ENDPOINTS.MEDIAPLAYER.StartDefaultMediaPlayer.methods[0],
//         mutationKey: [API_ENDPOINTS.MEDIAPLAYER.StartDefaultMediaPlayer.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// mediastream
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetMediastreamSettings() {
//     return useServerQuery<Models_MediastreamSettings>({
//         endpoint: API_ENDPOINTS.MEDIASTREAM.GetMediastreamSettings.endpoint,
//         method: API_ENDPOINTS.MEDIASTREAM.GetMediastreamSettings.methods[0],
//         queryKey: [API_ENDPOINTS.MEDIASTREAM.GetMediastreamSettings.key],
//         enabled: true,
//     })
// }

// export function useSaveMediastreamSettings() {
//     return useServerMutation<Models_MediastreamSettings, SaveMediastreamSettings_Variables>({
//         endpoint: API_ENDPOINTS.MEDIASTREAM.SaveMediastreamSettings.endpoint,
//         method: API_ENDPOINTS.MEDIASTREAM.SaveMediastreamSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.MEDIASTREAM.SaveMediastreamSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRequestMediastreamMediaContainer() {
//     return useServerMutation<Mediastream_MediaContainer, RequestMediastreamMediaContainer_Variables>({
//         endpoint: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.endpoint,
//         method: API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.methods[0],
//         mutationKey: [API_ENDPOINTS.MEDIASTREAM.RequestMediastreamMediaContainer.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePreloadMediastreamMediaContainer() {
//     return useServerMutation<boolean, PreloadMediastreamMediaContainer_Variables>({
//         endpoint: API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.endpoint,
//         method: API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.methods[0],
//         mutationKey: [API_ENDPOINTS.MEDIASTREAM.PreloadMediastreamMediaContainer.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useMediastreamShutdownTranscodeStream() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.endpoint,
//         method: API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.methods[0],
//         mutationKey: [API_ENDPOINTS.MEDIASTREAM.MediastreamShutdownTranscodeStream.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// metadata
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function usePopulateFillerData() {
//     return useServerMutation<true, PopulateFillerData_Variables>({
//         endpoint: API_ENDPOINTS.METADATA.PopulateFillerData.endpoint,
//         method: API_ENDPOINTS.METADATA.PopulateFillerData.methods[0],
//         mutationKey: [API_ENDPOINTS.METADATA.PopulateFillerData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRemoveFillerData() {
//     return useServerMutation<boolean, RemoveFillerData_Variables>({
//         endpoint: API_ENDPOINTS.METADATA.RemoveFillerData.endpoint,
//         method: API_ENDPOINTS.METADATA.RemoveFillerData.methods[0],
//         mutationKey: [API_ENDPOINTS.METADATA.RemoveFillerData.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetMediaMetadataParent(id: number) {
//     return useServerQuery<Models_MediaMetadataParent>({
//         endpoint: API_ENDPOINTS.METADATA.GetMediaMetadataParent.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.METADATA.GetMediaMetadataParent.methods[0],
//         queryKey: [API_ENDPOINTS.METADATA.GetMediaMetadataParent.key],
//         enabled: true,
//     })
// }

// export function useSaveMediaMetadataParent() {
//     return useServerMutation<Models_MediaMetadataParent, SaveMediaMetadataParent_Variables>({
//         endpoint: API_ENDPOINTS.METADATA.SaveMediaMetadataParent.endpoint,
//         method: API_ENDPOINTS.METADATA.SaveMediaMetadataParent.methods[0],
//         mutationKey: [API_ENDPOINTS.METADATA.SaveMediaMetadataParent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeleteMediaMetadataParent() {
//     return useServerMutation<boolean, DeleteMediaMetadataParent_Variables>({
//         endpoint: API_ENDPOINTS.METADATA.DeleteMediaMetadataParent.endpoint,
//         method: API_ENDPOINTS.METADATA.DeleteMediaMetadataParent.methods[0],
//         mutationKey: [API_ENDPOINTS.METADATA.DeleteMediaMetadataParent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// onlinestream
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetOnlineStreamEpisodeList() {
//     return useServerMutation<Onlinestream_EpisodeListResponse, GetOnlineStreamEpisodeList_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeList.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeList.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeList.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetOnlineStreamEpisodeSource() {
//     return useServerMutation<Onlinestream_EpisodeSource, GetOnlineStreamEpisodeSource_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeSource.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeSource.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.GetOnlineStreamEpisodeSource.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useOnlineStreamEmptyCache() {
//     return useServerMutation<boolean, OnlineStreamEmptyCache_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.OnlineStreamEmptyCache.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.OnlineStreamEmptyCache.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.OnlineStreamEmptyCache.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useOnlinestreamManualSearch() {
//     return useServerMutation<Array<HibikeOnlinestream_SearchResult>, OnlinestreamManualSearch_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualSearch.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualSearch.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualSearch.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useOnlinestreamManualMapping() {
//     return useServerMutation<boolean, OnlinestreamManualMapping_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualMapping.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualMapping.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.OnlinestreamManualMapping.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetOnlinestreamMapping() {
//     return useServerMutation<Onlinestream_MappingResponse, GetOnlinestreamMapping_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.GetOnlinestreamMapping.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.GetOnlinestreamMapping.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.GetOnlinestreamMapping.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useRemoveOnlinestreamMapping() {
//     return useServerMutation<boolean, RemoveOnlinestreamMapping_Variables>({
//         endpoint: API_ENDPOINTS.ONLINESTREAM.RemoveOnlinestreamMapping.endpoint,
//         method: API_ENDPOINTS.ONLINESTREAM.RemoveOnlinestreamMapping.methods[0],
//         mutationKey: [API_ENDPOINTS.ONLINESTREAM.RemoveOnlinestreamMapping.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// playback_manager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function usePlaybackPlayVideo() {
//     return useServerMutation<boolean, PlaybackPlayVideo_Variables>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayVideo.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayVideo.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayVideo.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackPlayRandomVideo() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayRandomVideo.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayRandomVideo.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayRandomVideo.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackSyncCurrentProgress() {
//     return useServerMutation<number>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackSyncCurrentProgress.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackSyncCurrentProgress.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackSyncCurrentProgress.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackPlayNextEpisode() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayNextEpisode.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayNextEpisode.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlayNextEpisode.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackGetNextEpisode() {
//     return useServerQuery<Anime_LocalFile>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackGetNextEpisode.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackGetNextEpisode.methods[0],
//         queryKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackGetNextEpisode.key],
//         enabled: true,
//     })
// }

// export function usePlaybackAutoPlayNextEpisode() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackAutoPlayNextEpisode.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackAutoPlayNextEpisode.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackAutoPlayNextEpisode.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackStartPlaylist() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartPlaylist.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartPlaylist.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartPlaylist.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackCancelCurrentPlaylist() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelCurrentPlaylist.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelCurrentPlaylist.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelCurrentPlaylist.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackPlaylistNext() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlaylistNext.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlaylistNext.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackPlaylistNext.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackStartManualTracking() {
//     return useServerMutation<boolean, PlaybackStartManualTracking_Variables>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartManualTracking.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartManualTracking.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackStartManualTracking.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function usePlaybackCancelManualTracking() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelManualTracking.endpoint,
//         method: API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelManualTracking.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYBACK_MANAGER.PlaybackCancelManualTracking.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// playlist
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useCreatePlaylist() {
//     return useServerMutation<Anime_Playlist, CreatePlaylist_Variables>({
//         endpoint: API_ENDPOINTS.PLAYLIST.CreatePlaylist.endpoint,
//         method: API_ENDPOINTS.PLAYLIST.CreatePlaylist.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYLIST.CreatePlaylist.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetPlaylists() {
//     return useServerQuery<Array<Anime_Playlist>>({
//         endpoint: API_ENDPOINTS.PLAYLIST.GetPlaylists.endpoint,
//         method: API_ENDPOINTS.PLAYLIST.GetPlaylists.methods[0],
//         queryKey: [API_ENDPOINTS.PLAYLIST.GetPlaylists.key],
//         enabled: true,
//     })
// }

// export function useUpdatePlaylist(id: number) {
//     return useServerMutation<Anime_Playlist, UpdatePlaylist_Variables>({
//         endpoint: API_ENDPOINTS.PLAYLIST.UpdatePlaylist.endpoint.replace("{id}", String(id)),
//         method: API_ENDPOINTS.PLAYLIST.UpdatePlaylist.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYLIST.UpdatePlaylist.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeletePlaylist() {
//     return useServerMutation<boolean, DeletePlaylist_Variables>({
//         endpoint: API_ENDPOINTS.PLAYLIST.DeletePlaylist.endpoint,
//         method: API_ENDPOINTS.PLAYLIST.DeletePlaylist.methods[0],
//         mutationKey: [API_ENDPOINTS.PLAYLIST.DeletePlaylist.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetPlaylistEpisodes(id: number, progress: number) {
//     return useServerQuery<Array<Anime_PlaylistEpisode>>({
//         endpoint: API_ENDPOINTS.PLAYLIST.GetPlaylistEpisodes.endpoint.replace("{id}", String(id)).replace("{progress}", String(progress)),
//         method: API_ENDPOINTS.PLAYLIST.GetPlaylistEpisodes.methods[0],
//         queryKey: [API_ENDPOINTS.PLAYLIST.GetPlaylistEpisodes.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// releases
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useInstallLatestUpdate() {
//     return useServerMutation<Status, InstallLatestUpdate_Variables>({
//         endpoint: API_ENDPOINTS.RELEASES.InstallLatestUpdate.endpoint,
//         method: API_ENDPOINTS.RELEASES.InstallLatestUpdate.methods[0],
//         mutationKey: [API_ENDPOINTS.RELEASES.InstallLatestUpdate.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetLatestUpdate() {
//     return useServerQuery<Updater_Update>({
//         endpoint: API_ENDPOINTS.RELEASES.GetLatestUpdate.endpoint,
//         method: API_ENDPOINTS.RELEASES.GetLatestUpdate.methods[0],
//         queryKey: [API_ENDPOINTS.RELEASES.GetLatestUpdate.key],
//         enabled: true,
//     })
// }

// export function useGetChangelog() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.RELEASES.GetChangelog.endpoint,
//         method: API_ENDPOINTS.RELEASES.GetChangelog.methods[0],
//         queryKey: [API_ENDPOINTS.RELEASES.GetChangelog.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// report
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useSaveIssueReport() {
//     return useServerMutation<boolean, SaveIssueReport_Variables>({
//         endpoint: API_ENDPOINTS.REPORT.SaveIssueReport.endpoint,
//         method: API_ENDPOINTS.REPORT.SaveIssueReport.methods[0],
//         mutationKey: [API_ENDPOINTS.REPORT.SaveIssueReport.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDownloadIssueReport() {
//     return useServerQuery<Report_IssueReport>({
//         endpoint: API_ENDPOINTS.REPORT.DownloadIssueReport.endpoint,
//         method: API_ENDPOINTS.REPORT.DownloadIssueReport.methods[0],
//         queryKey: [API_ENDPOINTS.REPORT.DownloadIssueReport.key],
//         enabled: true,
//     })
// }

// export function useDecompressIssueReport() {
//     return useServerMutation<Report_IssueReport>({
//         endpoint: API_ENDPOINTS.REPORT.DecompressIssueReport.endpoint,
//         method: API_ENDPOINTS.REPORT.DecompressIssueReport.methods[0],
//         mutationKey: [API_ENDPOINTS.REPORT.DecompressIssueReport.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// scan
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useScanLocalFiles() {
//     return useServerMutation<Array<Anime_LocalFile>, ScanLocalFiles_Variables>({
//         endpoint: API_ENDPOINTS.SCAN.ScanLocalFiles.endpoint,
//         method: API_ENDPOINTS.SCAN.ScanLocalFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.SCAN.ScanLocalFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// scan_summary
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetScanSummaries() {
//     return useServerQuery<Array<Summary_ScanSummaryItem>>({
//         endpoint: API_ENDPOINTS.SCAN_SUMMARY.GetScanSummaries.endpoint,
//         method: API_ENDPOINTS.SCAN_SUMMARY.GetScanSummaries.methods[0],
//         queryKey: [API_ENDPOINTS.SCAN_SUMMARY.GetScanSummaries.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// settings
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetSettings() {
//     return useServerQuery<Models_Settings>({
//         endpoint: API_ENDPOINTS.SETTINGS.GetSettings.endpoint,
//         method: API_ENDPOINTS.SETTINGS.GetSettings.methods[0],
//         queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key],
//         enabled: true,
//     })
// }

// export function useGettingStarted() {
//     return useServerMutation<Status, GettingStarted_Variables>({
//         endpoint: API_ENDPOINTS.SETTINGS.GettingStarted.endpoint,
//         method: API_ENDPOINTS.SETTINGS.GettingStarted.methods[0],
//         mutationKey: [API_ENDPOINTS.SETTINGS.GettingStarted.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useSaveSettings() {
//     return useServerMutation<Status, SaveSettings_Variables>({
//         endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
//         method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.SETTINGS.SaveSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useSaveAutoDownloaderSettings() {
//     return useServerMutation<boolean, SaveAutoDownloaderSettings_Variables>({
//         endpoint: API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.endpoint,
//         method: API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.SETTINGS.SaveAutoDownloaderSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useSaveMediaPlayerSettings() {
//     return useServerMutation<boolean, SaveMediaPlayerSettings_Variables>({
//         endpoint: API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.endpoint,
//         method: API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.SETTINGS.SaveMediaPlayerSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// status
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetStatus() {
//     return useServerQuery<Status>({
//         endpoint: API_ENDPOINTS.STATUS.GetStatus.endpoint,
//         method: API_ENDPOINTS.STATUS.GetStatus.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetStatus.key],
//         enabled: true,
//     })
// }

// export function useGetLogFilenames() {
//     return useServerQuery<Array<string>>({
//         endpoint: API_ENDPOINTS.STATUS.GetLogFilenames.endpoint,
//         method: API_ENDPOINTS.STATUS.GetLogFilenames.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetLogFilenames.key],
//         enabled: true,
//     })
// }

// export function useDeleteLogs() {
//     return useServerMutation<boolean, DeleteLogs_Variables>({
//         endpoint: API_ENDPOINTS.STATUS.DeleteLogs.endpoint,
//         method: API_ENDPOINTS.STATUS.DeleteLogs.methods[0],
//         mutationKey: [API_ENDPOINTS.STATUS.DeleteLogs.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetLatestLogContent() {
//     return useServerQuery<string>({
//         endpoint: API_ENDPOINTS.STATUS.GetLatestLogContent.endpoint,
//         method: API_ENDPOINTS.STATUS.GetLatestLogContent.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetLatestLogContent.key],
//         enabled: true,
//     })
// }

// export function useGetAnnouncements() {
//     return useServerMutation<Array<Updater_Announcement>, GetAnnouncements_Variables>({
//         endpoint: API_ENDPOINTS.STATUS.GetAnnouncements.endpoint,
//         method: API_ENDPOINTS.STATUS.GetAnnouncements.methods[0],
//         mutationKey: [API_ENDPOINTS.STATUS.GetAnnouncements.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetMemoryStats() {
//     return useServerQuery<MemoryStatsResponse>({
//         endpoint: API_ENDPOINTS.STATUS.GetMemoryStats.endpoint,
//         method: API_ENDPOINTS.STATUS.GetMemoryStats.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetMemoryStats.key],
//         enabled: true,
//     })
// }

// export function useGetMemoryProfile() {
//     return useServerQuery<null>({
//         endpoint: API_ENDPOINTS.STATUS.GetMemoryProfile.endpoint,
//         method: API_ENDPOINTS.STATUS.GetMemoryProfile.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetMemoryProfile.key],
//         enabled: true,
//     })
// }

// export function useGetGoRoutineProfile() {
//     return useServerQuery<null>({
//         endpoint: API_ENDPOINTS.STATUS.GetGoRoutineProfile.endpoint,
//         method: API_ENDPOINTS.STATUS.GetGoRoutineProfile.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetGoRoutineProfile.key],
//         enabled: true,
//     })
// }

// export function useGetCPUProfile() {
//     return useServerQuery<null>({
//         endpoint: API_ENDPOINTS.STATUS.GetCPUProfile.endpoint,
//         method: API_ENDPOINTS.STATUS.GetCPUProfile.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetCPUProfile.key],
//         enabled: true,
//     })
// }

// export function useForceGC() {
//     return useServerMutation<MemoryStatsResponse>({
//         endpoint: API_ENDPOINTS.STATUS.ForceGC.endpoint,
//         method: API_ENDPOINTS.STATUS.ForceGC.methods[0],
//         mutationKey: [API_ENDPOINTS.STATUS.ForceGC.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetHomeItems() {
//     return useServerQuery<Array<Models_HomeItem>>({
//         endpoint: API_ENDPOINTS.STATUS.GetHomeItems.endpoint,
//         method: API_ENDPOINTS.STATUS.GetHomeItems.methods[0],
//         queryKey: [API_ENDPOINTS.STATUS.GetHomeItems.key],
//         enabled: true,
//     })
// }

// export function useUpdateHomeItems() {
//     return useServerMutation<null, UpdateHomeItems_Variables>({
//         endpoint: API_ENDPOINTS.STATUS.UpdateHomeItems.endpoint,
//         method: API_ENDPOINTS.STATUS.UpdateHomeItems.methods[0],
//         mutationKey: [API_ENDPOINTS.STATUS.UpdateHomeItems.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// theme
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetTheme() {
//     return useServerQuery<Models_Theme>({
//         endpoint: API_ENDPOINTS.THEME.GetTheme.endpoint,
//         method: API_ENDPOINTS.THEME.GetTheme.methods[0],
//         queryKey: [API_ENDPOINTS.THEME.GetTheme.key],
//         enabled: true,
//     })
// }

// export function useUpdateTheme() {
//     return useServerMutation<Models_Theme, UpdateTheme_Variables>({
//         endpoint: API_ENDPOINTS.THEME.UpdateTheme.endpoint,
//         method: API_ENDPOINTS.THEME.UpdateTheme.methods[0],
//         mutationKey: [API_ENDPOINTS.THEME.UpdateTheme.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// thumbnail
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetVideoThumbnail() {
//     return useServerQuery<boolean>({
//         endpoint: API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.endpoint,
//         method: API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.methods[0],
//         queryKey: [API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.key],
//         enabled: true,
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// tmdb
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useTMDBSearch() {
//     return useServerMutation<Array<SearchResult>, TMDBSearch_Variables>({
//         endpoint: API_ENDPOINTS.TMDB.TMDBSearch.endpoint,
//         method: API_ENDPOINTS.TMDB.TMDBSearch.methods[0],
//         mutationKey: [API_ENDPOINTS.TMDB.TMDBSearch.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTMDBGetDetails() {
//     return useServerMutation<Record<string, interface{}>, TMDBGetDetails_Variables>({
//         endpoint: API_ENDPOINTS.TMDB.TMDBGetDetails.endpoint,
//         method: API_ENDPOINTS.TMDB.TMDBGetDetails.methods[0],
//         mutationKey: [API_ENDPOINTS.TMDB.TMDBGetDetails.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// torrent_client
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetActiveTorrentList() {
//     return useServerQuery<Array<TorrentClient_Torrent>>({
//         endpoint: API_ENDPOINTS.TORRENT_CLIENT.GetActiveTorrentList.endpoint,
//         method: API_ENDPOINTS.TORRENT_CLIENT.GetActiveTorrentList.methods[0],
//         queryKey: [API_ENDPOINTS.TORRENT_CLIENT.GetActiveTorrentList.key],
//         enabled: true,
//     })
// }

// export function useTorrentClientAction() {
//     return useServerMutation<boolean, TorrentClientAction_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAction.endpoint,
//         method: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAction.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAction.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentClientGetFiles() {
//     return useServerMutation<Array<string>, TorrentClientGetFiles_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientGetFiles.endpoint,
//         method: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientGetFiles.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_CLIENT.TorrentClientGetFiles.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentClientDownload() {
//     return useServerMutation<boolean, TorrentClientDownload_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientDownload.endpoint,
//         method: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientDownload.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_CLIENT.TorrentClientDownload.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentClientAddMagnetFromRule() {
//     return useServerMutation<boolean, TorrentClientAddMagnetFromRule_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAddMagnetFromRule.endpoint,
//         method: API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAddMagnetFromRule.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_CLIENT.TorrentClientAddMagnetFromRule.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// torrent_search
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useSearchTorrent() {
//     return useServerMutation<Torrent_SearchData, SearchTorrent_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_SEARCH.SearchTorrent.endpoint,
//         method: API_ENDPOINTS.TORRENT_SEARCH.SearchTorrent.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_SEARCH.SearchTorrent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetAutoSelectProfile() {
//     return useServerQuery<Anime_AutoSelectProfile>({
//         endpoint: API_ENDPOINTS.TORRENT_SEARCH.GetAutoSelectProfile.endpoint,
//         method: API_ENDPOINTS.TORRENT_SEARCH.GetAutoSelectProfile.methods[0],
//         queryKey: [API_ENDPOINTS.TORRENT_SEARCH.GetAutoSelectProfile.key],
//         enabled: true,
//     })
// }

// export function useSaveAutoSelectProfile() {
//     return useServerMutation<Anime_AutoSelectProfile, SaveAutoSelectProfile_Variables>({
//         endpoint: API_ENDPOINTS.TORRENT_SEARCH.SaveAutoSelectProfile.endpoint,
//         method: API_ENDPOINTS.TORRENT_SEARCH.SaveAutoSelectProfile.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_SEARCH.SaveAutoSelectProfile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useDeleteAutoSelectProfile() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.TORRENT_SEARCH.DeleteAutoSelectProfile.endpoint,
//         method: API_ENDPOINTS.TORRENT_SEARCH.DeleteAutoSelectProfile.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENT_SEARCH.DeleteAutoSelectProfile.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// torrentstream
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useGetTorrentstreamSettings() {
//     return useServerQuery<Models_TorrentstreamSettings>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamSettings.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamSettings.methods[0],
//         queryKey: [API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamSettings.key],
//         enabled: true,
//     })
// }

// export function useSaveTorrentstreamSettings() {
//     return useServerMutation<Models_TorrentstreamSettings, SaveTorrentstreamSettings_Variables>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.SaveTorrentstreamSettings.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.SaveTorrentstreamSettings.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.SaveTorrentstreamSettings.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetTorrentstreamTorrentFilePreviews() {
//     return useServerMutation<Array<Torrentstream_FilePreview>, GetTorrentstreamTorrentFilePreviews_Variables>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamTorrentFilePreviews.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamTorrentFilePreviews.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamTorrentFilePreviews.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentstreamStartStream() {
//     return useServerMutation<boolean, TorrentstreamStartStream_Variables>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStartStream.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStartStream.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStartStream.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentstreamStopStream() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStopStream.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStopStream.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.TorrentstreamStopStream.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useTorrentstreamDropTorrent() {
//     return useServerMutation<boolean>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamDropTorrent.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.TorrentstreamDropTorrent.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.TorrentstreamDropTorrent.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

// export function useGetTorrentstreamBatchHistory() {
//     return useServerMutation<Torrentstream_BatchHistoryResponse, GetTorrentstreamBatchHistory_Variables>({
//         endpoint: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamBatchHistory.endpoint,
//         method: API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamBatchHistory.methods[0],
//         mutationKey: [API_ENDPOINTS.TORRENTSTREAM.GetTorrentstreamBatchHistory.key],
//         onSuccess: async () => {
// 
//         },
//     })
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// videocore
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// export function useVideoCoreInSightGetCharacterDetails(malId: number) {
//     return useServerQuery<VideoCore_InSightCharacterDetails>({
//         endpoint: API_ENDPOINTS.VIDEOCORE.VideoCoreInSightGetCharacterDetails.endpoint.replace("{malId}", String(malId)),
//         method: API_ENDPOINTS.VIDEOCORE.VideoCoreInSightGetCharacterDetails.methods[0],
//         queryKey: [API_ENDPOINTS.VIDEOCORE.VideoCoreInSightGetCharacterDetails.key],
//         enabled: true,
//     })
// }

