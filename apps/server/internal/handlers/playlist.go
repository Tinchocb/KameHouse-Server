package handlers

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"

	"strconv"

	"github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
)

// HandleCreatePlaylist
//
//	@summary creates a new playlist.
//	@desc This will create a new playlist with the given name and episodes.
//	@desc The response is ignored, the client should re-fetch the playlists after this.
//	@route /api/v1/playlist [POST]
//	@returns anime.Playlist
func (h *Handler) HandleCreatePlaylist(c echo.Context) error {

	type body struct {
		Name     string                   `json:"name"`
		Episodes []*anime.PlaylistEpisode `json:"episodes"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Create the playlist
	playlist := anime.NewPlaylist(b.Name)
	playlist.SetEpisodes(b.Episodes)

	// Marshal episodes to JSON for storage
	data, err := json.Marshal(playlist.Episodes)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	entry := &models.Playlist{
		Name:  playlist.Name,
		Value: data,
	}

	// Save the playlist
	if err := db.SaveRawPlaylist(h.App.Database, entry); err != nil {
		return h.RespondWithError(c, err)
	}

	playlist.DbId = entry.ID
	return h.RespondWithData(c, playlist)
}

// HandleGetPlaylists
//
//	@summary returns all playlists.
//	@route /api/v1/playlists [GET]
//	@returns []anime.Playlist
func (h *Handler) HandleGetPlaylists(c echo.Context) error {

	rawPlaylists, err := db.GetRawPlaylists(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	playlists := make([]*anime.Playlist, 0)
	for _, p := range rawPlaylists {
		var eps []*anime.PlaylistEpisode
		if err := json.Unmarshal(p.Value, &eps); err == nil {
			playlist := anime.NewPlaylist(p.Name)
			playlist.SetEpisodes(eps)
			playlist.DbId = p.ID
			playlists = append(playlists, playlist)
		}
	}

	return h.RespondWithData(c, playlists)
}

// HandleUpdatePlaylist
//
//	@summary updates a playlist.
//	@returns the updated playlist
//	@desc The response is ignored, the client should re-fetch the playlists after this.
//	@route /api/v1/playlist [PATCH]
//	@param id - int - true - "The ID of the playlist to update."
//	@returns anime.Playlist
func (h *Handler) HandleUpdatePlaylist(c echo.Context) error {

	type body struct {
		DbId     uint                     `json:"dbId"`
		Name     string                   `json:"name"`
		Episodes []*anime.PlaylistEpisode `json:"episodes"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Recreate playlist
	playlist := anime.NewPlaylist(b.Name)
	playlist.DbId = b.DbId
	playlist.Name = b.Name
	playlist.SetEpisodes(b.Episodes)

	// Marshal episodes to JSON for storage
	data, err := json.Marshal(playlist.Episodes)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get the existing entry
	entry, err := db.GetRawPlaylist(h.App.Database, playlist.DbId)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Update the entry
	entry.Name = playlist.Name
	entry.Value = data

	// Save the playlist
	if err := db.UpdateRawPlaylist(h.App.Database, entry); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, playlist)
}

// HandleDeletePlaylist
//
//	@summary deletes a playlist.
//	@route /api/v1/playlist [DELETE]
//	@returns bool
func (h *Handler) HandleDeletePlaylist(c echo.Context) error {

	type body struct {
		DbId uint `json:"dbId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)

	}

	if err := db.DeletePlaylist(h.App.Database, b.DbId); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

// HandleGetPlaylistEpisodes
//
//	@summary returns all the local files of a playlist media entry that have not been watched.
//	@route /api/v1/playlist/episodes/{id} [GET]
//	@param id - int - true - "The ID of the media entry."
//	@param progress - int - true - "The progress of the media entry."
//	@returns []anime.PlaylistEpisode
func (h *Handler) HandleGetPlaylistEpisodes(c echo.Context) error {
	mId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get all local files
	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// removed nakama check

	lfw := anime.NewLocalFileWrapper(lfs)

	_, hasLocalEntry := lfw.GetLocalEntryById(mId)

	currentProgress := 0

	if animeEntry, found := animeCollection.GetListEntryFromAnimeId(mId); found {
		currentProgress = animeEntry.GetProgressSafe()
	}

	episodes := make([]*anime.PlaylistEpisode, 0)

	// If user has local files for this entry
	if hasLocalEntry {
		// Get the entry
		entry, err := h.getAnimeEntry(c, lfs, mId)
		if err != nil {
			return h.RespondWithError(c, err)
		}

		for _, ep := range entry.Episodes {
			if !ep.IsMain() || currentProgress >= ep.ProgressNumber {
				continue
			}
			episodes = append(episodes, &anime.PlaylistEpisode{
				Episode:     ep,
				IsCompleted: false,
				WatchType:   anime.WatchTypeLocalFile,
			})
		}
	} else {

		episodeCollection, err := h.getAnimeEpisodeCollection(c, mId)
		if err != nil {
			return h.RespondWithError(c, err)
		}

		for _, ep := range episodeCollection.Episodes {
			if currentProgress >= ep.ProgressNumber {
				continue
			}
			episodes = append(episodes, &anime.PlaylistEpisode{
				Episode:     ep,
				IsCompleted: false,
				WatchType:   "",
			})
		}

	}

	return h.RespondWithData(c, episodes)
}

//--------------------------------------------------------------------------------------------------------------------------------------------------//
