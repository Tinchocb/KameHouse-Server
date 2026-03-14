package directstream

import (
	"context"
	"fmt"
	"io"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/mkvparser"
	httputil "kamehouse/internal/util/http"
	"kamehouse/internal/util/result"
	"net/http"

	"github.com/google/uuid"
	"github.com/samber/mo"
)

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Torrent
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var _ Stream = (*DebridStream)(nil)

// DebridStream is a stream that is a torrent.
type DebridStream struct {
	BaseStream
	streamUrl     string
	contentLength int64
	filepath      string
	torrent       interface{}
	streamReadyCh chan struct{} // Closed by the initiator when the stream is ready
}

func (s *DebridStream) Type() StreamType {
	return StreamTypeDebrid
}

func (s *DebridStream) LoadContentType() string {
	s.contentTypeOnce.Do(func() {
		info, ok := s.manager.FetchStreamInfo(s.streamUrl)
		if !ok {
			s.logger.Warn().Str("url", s.streamUrl).Msg("directstream(debrid): Failed to fetch stream info for content type")
			return
		}
		s.logger.Debug().Str("url", s.streamUrl).Str("contentType", info.ContentType).Int64("contentLength", info.ContentLength).Msg("directstream(debrid): Fetched content type and length")
		s.contentType = info.ContentType
		if s.contentType == "application/force-download" {
			s.contentType = "application/octet-stream"
		}
		s.contentLength = info.ContentLength
	})

	return s.contentType
}

// Terminate overrides BaseStream.Terminate
func (s *DebridStream) Terminate() {
	s.logger.Debug().Msg("directstream(debrid): Terminating debrid stream")
	s.BaseStream.Terminate()
}

func (s *DebridStream) LoadPlaybackInfo() (ret *PlaybackInfo, err error) {
	s.playbackInfoOnce.Do(func() {
		if s.streamUrl == "" {
			ret = &PlaybackInfo{}
			err = fmt.Errorf("stream url is not set")
			s.playbackInfoErr = err
			return
		}

		id := uuid.New().String()

		var entryListData *anime.EntryListData
		if animeCollection, ok := s.manager.animeCollection.Get(); ok {
			if listEntry, ok := animeCollection.GetListEntryFromAnimeId(s.media.ID); ok {
				/* if customsource.IsExtensionId(entry.Media.GetID()) {
					continue
				} */
				entryListData = anime.NewEntryListData(models.ToMediaEntryListData(listEntry))
			}
		}

		contentType := s.LoadContentType()

		playbackInfo := PlaybackInfo{
			ID:                id,
			StreamType:        s.Type(),
			StreamPath:        s.filepath,
			MimeType:          contentType,
			StreamUrl:         "{{SERVER_URL}}/api/v1/directstream/stream?id=" + id,
			ContentLength:     s.contentLength, // loaded by LoadContentType
			MkvMetadata:       nil,
			MkvMetadataParser: mo.None[*mkvparser.MetadataParser](),
			Episode:           s.episode,
			Media:             s.media,
			EntryListData:     entryListData,
		}

		// If the content type is an EBML content type, we can create a metadata parser
		// Note: We'll assume everything that comes from debrid is an EBML file
		if isEbmlContent(s.LoadContentType()) || s.LoadContentType() == "application/octet-stream" || s.LoadContentType() == "application/force-download" {
			reader, err := httputil.NewHttpReadSeekerFromURL(s.streamUrl)
			//reader, err := s.getPriorityReader()
			if err != nil {
				err = fmt.Errorf("failed to create reader for stream url: %w", err)
				s.logger.Error().Err(err).Msg("directstream(debrid): Failed to create reader for stream url")
				s.playbackInfoErr = err
				return
			}
			defer reader.Close() // Close this specific reader instance

			_, _ = reader.Seek(0, io.SeekStart)
			s.logger.Trace().Msgf(
				"directstream(debrid): Loading metadata for stream url: %s",
				s.streamUrl,
			)

			parser := mkvparser.NewMetadataParser(reader, s.logger)
			metadata := parser.GetMetadata(context.Background())
			if metadata.Error != nil {
				err = fmt.Errorf("failed to get metadata: %w", metadata.Error)
				s.logger.Error().Err(metadata.Error).Msg("directstream(debrid): Failed to get metadata")
				s.playbackInfoErr = err
				return
			}

			playbackInfo.MkvMetadata = metadata
			playbackInfo.MkvMetadataParser = mo.Some(parser)
		}

		s.playbackInfo = &playbackInfo
	})

	return s.playbackInfo, s.playbackInfoErr
}

func (s *DebridStream) GetAttachmentByName(filename string) (*mkvparser.AttachmentInfo, bool) {
	return getAttachmentByName(s.manager.playbackCtx, s, filename)
}

// GetStreamHandler returns an HTTP handler that redirects the client directly to the Debrid CDN URL.
// This avoids proxying video bytes through the Go server, saving RAM and bandwidth.
// For HEAD requests, we still return content metadata so players can prepare.
func (s *DebridStream) GetStreamHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.streamUrl == "" {
			s.logger.Error().Msg("directstream(debrid): No URL to stream")
			http.Error(w, "No URL to stream", http.StatusNotFound)
			return
		}

		// Inject CORS headers so the browser allows the redirect to the Debrid CDN
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type")

		// Handle CORS preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// HEAD requests: return metadata headers without downloading anything
		if r.Method == http.MethodHead {
			s.logger.Trace().Msg("directstream(debrid): Handling HEAD request")
			w.Header().Set("Content-Length", fmt.Sprintf("%d", s.contentLength))
			w.Header().Set("Content-Type", s.LoadContentType())
			w.Header().Set("Accept-Ranges", "bytes")
			w.WriteHeader(http.StatusOK)
			return
		}

		// GET requests: redirect the client directly to the Debrid CDN
		s.logger.Debug().Str("url", s.streamUrl).Msg("directstream(debrid): Redirecting client to Debrid CDN")
		http.Redirect(w, r, s.streamUrl, http.StatusFound)
	})
}

type PlayDebridStreamOptions struct {
	StreamUrl    string
	MediaId      int
	AnidbEpisode string // Anizip episode
	Media        *anilist.BaseAnime
	Torrent      interface{} // Selected torrent
	FileId       string      // File ID or index
	UserAgent    string
	ClientId     string
	AutoSelect   bool
}

// PlayDebridStream is used by a module to load a new debrid stream.
func (m *Manager) PlayDebridStream(ctx context.Context, filepath string, opts PlayDebridStreamOptions) error {
	m.playbackMu.Lock()
	defer m.playbackMu.Unlock()

	episodeCollection, err := anime.NewEpisodeCollection(anime.NewEpisodeCollectionOptions{
		AnimeMetadata:       nil,
		Media:               models.ToLibraryMedia(opts.Media),
		MetadataProviderRef: m.metadataProviderRef,
		Logger:              m.Logger,
	})
	if err != nil {
		return fmt.Errorf("cannot play local file, could not create episode collection: %w", err)
	}

	episode, ok := episodeCollection.FindEpisodeByAniDB(opts.AnidbEpisode)
	if !ok {
		return fmt.Errorf("cannot play debrid stream, could not find episode: %s", opts.AnidbEpisode)
	}

	stream := &DebridStream{
		streamUrl: opts.StreamUrl,
		torrent:   opts.Torrent,
		filepath:  filepath,
		BaseStream: BaseStream{
			manager:               m,
			logger:                m.Logger,
			clientId:              opts.ClientId,
			media:                 opts.Media,
			filename:              "",
			episode:               episode,
			episodeCollection:     episodeCollection,
			subtitleEventCache:    result.NewMap[string, *mkvparser.SubtitleEvent](),
			activeSubtitleStreams: result.NewMap[string, *SubtitleStream](),
		},
		streamReadyCh: make(chan struct{}),
	}

	go func() {
		m.loadStream(stream)
	}()

	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
