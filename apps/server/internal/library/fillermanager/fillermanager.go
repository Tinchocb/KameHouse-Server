package fillermanager

import (
	"kamehouse/internal/api/filler"
	"kamehouse/internal/database/db"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	lop "github.com/samber/lo/parallel"
)

type (
	FillerManager struct {
		db        *db.Database
		logger    *zerolog.Logger
		fillerApi filler.API
	}

	NewFillerManagerOptions struct {
		DB     *db.Database
		Logger *zerolog.Logger
	}
)

func New(opts *NewFillerManagerOptions) *FillerManager {
	return &FillerManager{
		db:        opts.DB,
		logger:    opts.Logger,
		fillerApi: filler.NewAnimeFillerList(opts.Logger),
	}
}

func (fm *FillerManager) HasFillerFetched(mediaID int) bool {

	defer util.HandlePanicInModuleThen("library/fillermanager/HasFillerFetched", func() {
	})

	_, ok := fm.db.GetMediaFillerItem(mediaID)
	return ok
}

func (fm *FillerManager) FetchAndStoreFillerData(mediaID int, titles []string) error {

	defer util.HandlePanicInModuleThen("library/fillermanager/FetchAndStoreFillerData", func() {
	})

	fm.logger.Debug().Int("mediaID", mediaID).Msg("fillermanager: Fetching filler data")

	res, err := fm.fillerApi.Search(filler.SearchOptions{
		Titles: titles,
	})
	if err != nil {
		return err
	}

	fm.logger.Debug().Int("mediaID", mediaID).Str("slug", res.Slug).Msg("fillermanager: Fetched filler data")

	return fm.fetchAndStoreFillerDataFromSlug(mediaID, res.Slug)
}

func (fm *FillerManager) fetchAndStoreFillerDataFromSlug(mediaID int, slug string) error {

	defer util.HandlePanicInModuleThen("library/fillermanager/FetchAndStoreFillerDataFromSlug", func() {
	})

	fillerData, err := fm.fillerApi.FindFillerData(slug)
	if err != nil {
		return err
	}

	err = fm.db.InsertMediaFiller(
		"animefillerlist",
		mediaID,
		slug,
		time.Now(),
		fillerData.FillerEpisodes,
	)
	if err != nil {
		return err
	}

	return nil
}

func (fm *FillerManager) RemoveFillerData(mediaID int) error {

	defer util.HandlePanicInModuleThen("library/fillermanager/RemoveFillerData", func() {
	})

	fm.logger.Debug().Int("mediaID", mediaID).Msg("fillermanager: Removing filler data")

	return fm.db.DeleteMediaFiller(mediaID)
}

func (fm *FillerManager) IsEpisodeFiller(mediaID int, episodeNumber int) bool {

	defer util.HandlePanicInModuleThen("library/fillermanager/IsEpisodeFiller", func() {
	})

	mediaFillerData, ok := fm.db.GetMediaFillerItem(mediaID)
	if !ok {
		return false
	}

	if len(mediaFillerData.FillerEpisodes) == 0 {
		return false
	}

	for _, ep := range mediaFillerData.FillerEpisodes {
		if ep == strconv.Itoa(episodeNumber) {
			return true
		}
	}

	return false
}

func (fm *FillerManager) HydrateFillerData(e *anime.Entry) {
	if fm == nil {
		return
	}
	if e == nil || e.Media == nil || e.Episodes == nil || len(e.Episodes) == 0 {
		return
	}

	// Check if the filler data has been fetched
	if !fm.HasFillerFetched(int(e.Media.ID)) {
		return
	}

	lop.ForEach(e.Episodes, func(ep *anime.Episode, _ int) {
		if ep == nil || ep.EpisodeMetadata == nil {
			return
		}
		ep.EpisodeMetadata.IsFiller = fm.IsEpisodeFiller(int(e.Media.ID), ep.EpisodeNumber)
	})
}

func (fm *FillerManager) HydrateEpisodeFillerData(mID int, episodes []*anime.Episode) {
	if fm == nil || len(episodes) == 0 {
		return
	}

	// Check if the filler data has been fetched
	if !fm.HasFillerFetched(mID) {
		return
	}

	lop.ForEach(episodes, func(e *anime.Episode, _ int) {
		//h.App.FillerManager.HydrateEpisodeFillerData(mID, e)
		e.EpisodeMetadata.IsFiller = fm.IsEpisodeFiller(mID, e.EpisodeNumber)
	})
}
