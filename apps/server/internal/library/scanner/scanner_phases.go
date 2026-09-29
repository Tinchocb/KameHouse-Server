package scanner

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/filesystem"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// Fases de Scanner.Scan. Cada una es un paso con nombre del pipeline; Scan
// solo las encadena y reporta progreso.

// collectSkippedLocalFiles decide qué archivos ya conocidos no hace falta
// re-escanear: los de Drive, los bloqueados/ignorados (según opciones), los que
// no cambiaron en un escaneo rápido y los archivos archivados (shelved) que
// volvieron a aparecer. Los de una biblioteca desconectada se archivan para no
// borrarlos.
func (scn *Scanner) collectSkippedLocalFiles(sortedLibraryPaths []string) map[string]*dto.LocalFile {
	skippedLfs := make(map[string]*dto.LocalFile)

	if scn.ExistingLocalFiles != nil {
		libraryPathExistsCache := make(map[string]bool)

		// Retrieve skipped files from existing local files
		for _, lf := range scn.ExistingLocalFiles {
			if lf == nil {
				continue
			}
			if strings.HasPrefix(lf.Path, "gdrive://") {
				skippedLfs[lf.GetNormalizedPath()] = lf
				continue
			}

			// Check if the file exists physically
			stat, err := os.Stat(lf.Path)
			exists := err == nil

			if !exists && scn.WithShelving {
				// The file does not exist. Check if the containing library path is offline!
				var matchedLibPath string
				for _, libPath := range sortedLibraryPaths {
					if strings.HasPrefix(lf.GetNormalizedPath(), util.NormalizePath(libPath)) {
						matchedLibPath = libPath
						break
					}
				}

				if matchedLibPath != "" {
					existsLib, checked := libraryPathExistsCache[matchedLibPath]
					if !checked {
						_, errLib := os.Stat(matchedLibPath)
						existsLib = errLib == nil || !os.IsNotExist(errLib)
						libraryPathExistsCache[matchedLibPath] = existsLib
						if !existsLib {
							scn.Logger.Warn().Str("libraryPath", matchedLibPath).Msg("scanner: containing library folder is offline/disconnected. Shelving files from deletion.")
						}
					}

					if !existsLib {
						// Library path is offline! We must SHELVE this file to protect it from deletion!
						scn.Logger.Debug().Str("path", lf.Path).Msg("scanner: shelving file because its library is offline")
						scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, lf)
						// Also add to skippedLfs so we don't process it further in this scan
						skippedLfs[lf.GetNormalizedPath()] = lf
						continue
					}
				}
			}

			// 1. Explicit skip (locked/ignored)
			if (scn.SkipLockedFiles && lf.IsLocked()) || (scn.SkipIgnoredFiles && lf.IsIgnored()) {
				skippedLfs[lf.GetNormalizedPath()] = lf
				continue
			}

			// 2. File Map optimization (Fast Scan)
			if scn.ScanMode != "deep" {
				if exists {
					if stat.Size() == lf.FileSize && stat.ModTime().Unix() == lf.FileModTime {
						skippedLfs[lf.GetNormalizedPath()] = lf
						continue
					}
				}
			}
		}
	}

	return skippedLfs
}

// unshelveReappearedFiles agrega a skippedLfs los archivos archivados que
// volvieron a existir (no se re-escanean).
func (scn *Scanner) unshelveReappearedFiles(skippedLfs map[string]*dto.LocalFile) {
	scn.Logger.Debug().Int("count", len(scn.ExistingShelvedFiles)).Msg("scanner: Verifying shelved files")

	for _, shelvedLf := range scn.ExistingShelvedFiles {
		if filesystem.FileExists(shelvedLf.Path) {
			skippedLfs[shelvedLf.GetNormalizedPath()] = shelvedLf
		}
	}
}

// logParsedLocalFiles vuelca al log de escaneo lo que se parseó de cada archivo.
func (scn *Scanner) logParsedLocalFiles(localFiles []*dto.LocalFile, skippedLfs map[string]*dto.LocalFile) {
	if scn.ScanLogger == nil {
		return
	}
	scn.ScanLogger.logger.Debug().
		Any("count", len(localFiles)).
		Msg("Local files to be scanned")
	scn.ScanLogger.logger.Debug().
		Any("count", len(skippedLfs)).
		Msg("Skipped files")

	scn.ScanLogger.logger.Debug().
		Msg("===========================================================================================================")

	for _, lf := range localFiles {
		scn.ScanLogger.logger.Trace().
			Str("path", lf.Path).
			Str("filename", lf.Name).
			Interface("parsedData", lf.ParsedData).
			Interface("parsedFolderData", lf.ParsedFolderData).
			Msg("Parsed local file")
	}

	scn.ScanLogger.logger.Debug().
		Msg("===========================================================================================================")
}

// mergeSkippedFiles devuelve localFiles más los archivos salteados que siguen
// existiendo. Los que desaparecieron y están bloqueados se archivan si el
// archivado está activo.
func (scn *Scanner) mergeSkippedFiles(localFiles []*dto.LocalFile, skippedLfs map[string]*dto.LocalFile) []*dto.LocalFile {
	for _, sf := range skippedLfs {
		if filesystem.FileExists(sf.Path) { // Verify that the file still exists
			localFiles = append(localFiles, sf)
		} else if scn.WithShelving && sf.IsLocked() { // If the file is locked and shelving is enabled, shelve it
			scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, sf)
		}
	}
	return localFiles
}

// nfoEntry holds all parsed data for one NFO match. Workers produce these;
// the post-processing phase is the sole consumer that writes to the DB.
type nfoEntry struct {
	lf         *dto.LocalFile
	media      *models.LibraryMedia
	folderPath string
	isPerFile  bool
	tmdbID     int // 0 when the NFO contains no TMDB ID
}

// resolveNfoMetadata busca archivos .nfo de Kodi junto a los videos y crea el
// LibraryMedia correspondiente, asignando LibraryMediaId a los archivos (y a
// sus hermanos de carpeta cuando el NFO es de carpeta).
func (scn *Scanner) resolveNfoMetadata(ctx context.Context, localFiles []*dto.LocalFile) {
	scn.Logger.Debug().Msg("scanner: Looking for local NFO metadata files")

	nfoEntries := scn.parseNfoEntries(ctx, localFiles)
	if scn.Database == nil || len(nfoEntries) == 0 {
		return
	}
	scn.persistNfoEntries(localFiles, nfoEntries)
}

// parseNfoEntries recorre los archivos con un pool de workers acotado (solo
// CPU/IO, sin tocar la DB) y devuelve una entrada por NFO encontrado.
func (scn *Scanner) parseNfoEntries(ctx context.Context, localFiles []*dto.LocalFile) []*nfoEntry {
	// Bounded worker pool for NFO resolution
	maxWorkers := runtime.NumCPU()
	if maxWorkers < 4 {
		maxWorkers = 4
	}
	if maxWorkers > 16 {
		maxWorkers = 16
	}

	// nfoFolderClaimed prevents two workers from producing duplicate entries
	// for the same folder-level NFO. LoadOrStore acts as a non-blocking mutex.
	var nfoFolderClaimed sync.Map // folder path → true

	var nfoEntriesMu sync.Mutex
	var nfoEntries []*nfoEntry

	nfoJobs := make(chan *dto.LocalFile, 100)
	go func() {
		defer close(nfoJobs)
		for _, lf := range localFiles {
			select {
			case <-ctx.Done():
				return
			case nfoJobs <- lf:
			}
		}
	}()

	var nfoWg sync.WaitGroup
	for i := 0; i < maxWorkers; i++ {
		nfoWg.Add(1)
		go func() {
			defer nfoWg.Done()
			for lf := range nfoJobs {
				// Stop immediately if the scan context was cancelled
				select {
				case <-ctx.Done():
					return
				default:
				}

				if lf == nil || lf.LibraryMediaId != 0 || lf.MediaID != 0 {
					continue
				}

				lfDir := filepath.Dir(lf.Path)

				// Typical Kodi NFO paths
				nfoPaths := []string{
					util.ReplaceExtension(lf.Path, ".nfo"), // [filename].nfo (Per-file NFO takes priority)
					filepath.Join(lfDir, "tvshow.nfo"),
					filepath.Join(lfDir, "anime.nfo"),
					filepath.Join(lfDir, "movie.nfo"),
				}

				for _, nfoPath := range nfoPaths {
					if !filesystem.FileExists(nfoPath) {
						continue
					}
					nfo, err := ParseNfoFile(nfoPath)
					if err != nil || nfo == nil {
						continue
					}

					isPerFileNfo := strings.HasSuffix(strings.ToLower(nfoPath), ".nfo") &&
						!strings.HasSuffix(strings.ToLower(nfoPath), "tvshow.nfo") &&
						!strings.HasSuffix(strings.ToLower(nfoPath), "anime.nfo") &&
						!strings.HasSuffix(strings.ToLower(nfoPath), "movie.nfo")

					// For folder-level NFOs, use LoadOrStore to claim the folder atomically.
					// Only the worker that wins the race produces an entry; others skip.
					if !isPerFileNfo {
						if _, alreadyClaimed := nfoFolderClaimed.LoadOrStore(lfDir, true); alreadyClaimed {
							break // another worker already claimed this folder
						}
					}

					format := "TV"
					if nfo.XMLName.Local == "movie" {
						format = "MOVIE"
					}

					entry := &nfoEntry{
						lf: lf,
						media: &models.LibraryMedia{
							Type:          "ANIME",
							Format:        format,
							TitleOriginal: nfo.OriginalTitle,
							TitleRomaji:   nfo.Title,
							TitleEnglish:  nfo.Title,
							Description:   nfo.Plot,
							Rating:        nfo.Rating,
							Year:          nfo.Year,
						},
						folderPath: lfDir,
						isPerFile:  isPerFileNfo,
						tmdbID:     nfo.GetTmdbID(),
					}

					nfoEntriesMu.Lock()
					nfoEntries = append(nfoEntries, entry)
					nfoEntriesMu.Unlock()
					break
				}
			}
		}()
	}
	nfoWg.Wait()

	return nfoEntries
}

// persistNfoEntries es la única fase que escribe a la DB: los registros con
// TMDB ID van por UpsertLibraryMediaBatch; los locales (tmdb_id = 0) se insertan
// uno a uno para preservar la unicidad. Después propaga los IDs de carpeta.
func (scn *Scanner) persistNfoEntries(localFiles []*dto.LocalFile, nfoEntries []*nfoEntry) {
	// folder path → LibraryMedia ID (uint), para propagar a los hermanos.
	var nfoFolderMap sync.Map

	withTmdb := make([]*nfoEntry, 0, len(nfoEntries))
	withoutTmdb := make([]*nfoEntry, 0, len(nfoEntries))
	for _, e := range nfoEntries {
		if e.tmdbID > 0 {
			e.media.TmdbID = e.tmdbID
			withTmdb = append(withTmdb, e)
		} else {
			withoutTmdb = append(withoutTmdb, e)
		}
	}

	// 1. Batch upsert for entries that have a TMDB ID.
	if len(withTmdb) > 0 {
		mediaBatch := make([]*models.LibraryMedia, len(withTmdb))
		for i, e := range withTmdb {
			mediaBatch[i] = e.media
		}
		// Solo los que faltan: el NFO trae datos parciales y no debe pisar un
		// LibraryMedia ya enriquecido (póster, descripción…).
		if batchErr := db.InsertLibraryMediaBatchIfMissing(scn.Database, mediaBatch, 20); batchErr != nil {
			scn.Logger.Error().Err(batchErr).Msg("scanner: NFO batch upsert failed, skipping ID mapping for this batch")
		} else {
			// Query back the persisted records to retrieve their auto-generated IDs.
			// Fetch in chunks of 500 to avoid SQLite variable limits (too many SQL variables error)
			var persisted []*models.LibraryMedia
			tmdbIDs := make([]int, len(withTmdb))
			for i, e := range withTmdb {
				tmdbIDs[i] = e.tmdbID
			}
			const chunkSize = 500
			for i := 0; i < len(tmdbIDs); i += chunkSize {
				end := i + chunkSize
				if end > len(tmdbIDs) {
					end = len(tmdbIDs)
				}
				var chunkPersisted []*models.LibraryMedia
				err := scn.Database.Gorm().Where("tmdb_id IN ? AND type = ?", tmdbIDs[i:end], "ANIME").Find(&chunkPersisted).Error
				if err == nil {
					persisted = append(persisted, chunkPersisted...)
				} else {
					scn.Logger.Error().Err(err).Msg("scanner: Failed to retrieve persisted media chunk")
				}
			}

			type tmdbTypeKey struct {
				tmdbID    int
				mediaType string
			}
			idMap := make(map[tmdbTypeKey]uint, len(persisted))
			for _, m := range persisted {
				idMap[tmdbTypeKey{m.TmdbID, m.Type}] = m.ID
			}

			for _, e := range withTmdb {
				key := tmdbTypeKey{e.tmdbID, e.media.Type}
				if id, ok := idMap[key]; ok {
					e.lf.LibraryMediaId = id
					e.lf.MediaID = e.tmdbID
					if !e.isPerFile {
						nfoFolderMap.Store(e.folderPath, id)
					}
					scn.Logger.Info().
						Str("filename", e.lf.Name).
						Uint("libraryMediaId", id).
						Msg("scanner: Created LibraryMedia via local NFO (batch)")
				}
			}
		}
	}

	// 2. Individual inserts for local-only NFO records (no TMDB ID).
	// These can't be safely batched since they share tmdb_id = 0.
	for _, e := range withoutTmdb {
		saved, err := db.InsertLibraryMedia(scn.Database, e.media)
		if err == nil && saved != nil {
			e.lf.LibraryMediaId = saved.ID
			if !e.isPerFile {
				nfoFolderMap.Store(e.folderPath, saved.ID)
			}
			scn.Logger.Info().
				Str("filename", e.lf.Name).
				Uint("libraryMediaId", saved.ID).
				Msg("scanner: Created LibraryMedia via local NFO (local-only)")
		}
	}

	// 3. Propagate folder-level IDs to all local files in the same folder.
	// Workers only tagged the "owning" file per folder; siblings need the same ID.
	for _, lf := range localFiles {
		if lf == nil || lf.LibraryMediaId != 0 {
			continue
		}
		lfDir := filepath.Dir(lf.Path)
		if id, exists := nfoFolderMap.Load(lfDir); exists {
			lf.LibraryMediaId = id.(uint)
		}
	}
	scn.Database.Checkpoint()
}

// scanProviders son los clientes/proveedores de metadata de un escaneo.
type scanProviders struct {
	tmdbClient      *tmdb.Client
	tmdbProvider    *librarymetadata.TMDBProvider
	providers       []librarymetadata.Provider
	primaryProvider string
}

// buildMetadataProviders arma el cliente de TMDB (el provisto o uno desde
// ajustes/entorno), la lista ordenada de proveedores según el proveedor
// primario elegido, e inicializa MetadataProviderRef si no vino seteado.
func (scn *Scanner) buildMetadataProviders() scanProviders {
	var p scanProviders

	if scn.TMDBClient != nil {
		p.tmdbClient = scn.TMDBClient
		p.tmdbProvider = librarymetadata.NewTMDBProviderWithClient(p.tmdbClient, scn.Database)
		scn.Logger.Debug().Msg("scanner: Using provided TMDb client")
	} else {
		// Fallback for cases where it's not provided (e.g. background runs)
		tmdbToken := ""
		tmdbLanguage := ""
		if scn.Database != nil {
			if settings, err := scn.Database.GetSettings(); err == nil && settings != nil {
				tmdbToken = settings.Library.TmdbApiKey
				tmdbLanguage = settings.Library.TmdbLanguage
			}
		}
		if tmdbToken == "" {
			tmdbToken, _ = tmdb.ResolveTokenFromEnv()
		}
		tmdbToken = tmdb.SanitizeToken(tmdbToken)

		if tmdbToken != "" {
			p.tmdbClient = tmdb.NewClient(tmdbToken, tmdbLanguage)
			p.tmdbProvider = librarymetadata.NewTMDBProviderWithClient(p.tmdbClient, scn.Database)
			scn.Logger.Debug().Msg("scanner: TMDb client initialized from settings/env")
		}
	}

	if scn.UseTMDB {
		if p.tmdbProvider != nil {
			scn.Logger.Info().Msg("scanner: TMDB mode enabled")
		} else {
			scn.Logger.Warn().Msg("scanner: TMDB mode requested but TMDB token not set, falling back to default provider")
		}
	}

	if scn.Database != nil {
		if settings, err := scn.Database.GetSettings(); err == nil && settings != nil {
			p.primaryProvider = settings.Library.ScannerProvider
		}
	}

	p.providers = scn.MetadataProviders
	if len(p.providers) == 0 {
		aniListProvider := librarymetadata.NewAniListProvider(scn.Database, scn.Logger)
		jikanProvider := librarymetadata.NewJikanProvider(scn.Database, scn.Logger)
		aniDBProvider := librarymetadata.NewAniDBProvider("", scn.Logger)
		hasTmdb := p.tmdbProvider != nil && p.tmdbClient != nil && p.tmdbClient.HasApiKey()

		switch p.primaryProvider {
		case "anilist":
			p.providers = append(p.providers, aniListProvider)
			if hasTmdb {
				p.providers = append(p.providers, p.tmdbProvider)
			}
			p.providers = append(p.providers, jikanProvider, aniDBProvider)
		case "jikan":
			p.providers = append(p.providers, jikanProvider)
			if hasTmdb {
				p.providers = append(p.providers, p.tmdbProvider)
			}
			p.providers = append(p.providers, aniListProvider, aniDBProvider)
		default:
			if hasTmdb {
				p.providers = append(p.providers, p.tmdbProvider)
			}
			p.providers = append(p.providers, aniListProvider, jikanProvider, aniDBProvider)
		}
	}

	// Episode metadata provider: if MetadataProviderRef is unset, initialize it
	// with TMDB (if available), AniList, or Jikan fallback.
	if scn.MetadataProviderRef == nil {
		scn.MetadataProviderRef = metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
			Database:        scn.Database,
			Logger:          scn.Logger,
			TMDBClient:      p.tmdbClient,
			DefaultProvider: p.primaryProvider,
		})
		if p.primaryProvider == "anilist" {
			scn.Logger.Info().Msg("scanner: AniList episode metadata provider initialized")
		} else if p.tmdbClient != nil && p.tmdbClient.HasApiKey() {
			scn.Logger.Info().Msg("scanner: TMDB episode metadata provider initialized")
		} else {
			scn.Logger.Info().Msg("scanner: Jikan episode metadata provider initialized (no TMDB key)")
		}
	}

	return p
}

// collectMatchedMedia junta los IDs de medio de los archivos matcheados (más
// los de la colección) y detecta cuáles son películas (por la estructura de
// carpetas o por la convención de IDs >= 1.000.000).
func collectMatchedMedia(localFiles []*dto.LocalFile, collectionMediaIds []int, libraryPaths []string) (allMatchedIds map[int]struct{}, movieIds map[int]bool) {
	allMatchedIds = make(map[int]struct{})
	for _, lf := range localFiles {
		if lf.MediaID != 0 {
			allMatchedIds[lf.MediaID] = struct{}{}
		}
	}
	for _, id := range collectionMediaIds {
		allMatchedIds[id] = struct{}{}
	}

	// Como en el original: se parsea la carpeta de cada archivo de un medio
	// hasta encontrar una con nombre de serie.
	seen := make(map[int]bool)
	movieIds = make(map[int]bool)
	for _, lf := range localFiles {
		if lf.MediaID == 0 {
			continue
		}
		if !seen[lf.MediaID] {
			info := ParseFolderStructure(lf.Path, libraryPaths)
			if info.SeriesName != "" {
				seen[lf.MediaID] = true
			}
			if info.IsMovie {
				movieIds[lf.MediaID] = true
			}
		}
		// IDs with offset >= 1,000,000 are always movies (DragonBallResolver convention)
		if lf.MediaID >= 1_000_000 {
			movieIds[lf.MediaID] = true
		}
	}
	return allMatchedIds, movieIds
}
