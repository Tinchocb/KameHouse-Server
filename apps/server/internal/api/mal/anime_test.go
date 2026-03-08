package mal

import (
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"testing"

	"github.com/davecgh/go-spew/spew"
)

func TestGetAnimeDetails(t *testing.T) {
	test_utils.InitTestProvider(t, test_utils.MyAnimeList())

	malWrapper := NewWrapper(test_utils.ConfigData.Provider.MalJwt, util.NewLogger())

	res, err := malWrapper.GetAnimeDetails(51179)

	spew.Dump(res)

	if err != nil {
		t.Fatalf("error while fetching media, %v", err)
	}

	t.Log(res.Title)
}

func TestGetAnimeCollection(t *testing.T) {
	test_utils.InitTestProvider(t, test_utils.MyAnimeList())

	malWrapper := NewWrapper(test_utils.ConfigData.Provider.MalJwt, util.NewLogger())

	res, err := malWrapper.GetAnimeCollection()

	if err != nil {
		t.Fatalf("error while fetching anime collection, %v", err)
	}

	for _, entry := range res {
		t.Log(entry.Node.Title)
		if entry.Node.ID == 51179 {
			spew.Dump(entry)
		}
	}
}

func TestUpdateAnimeListStatus(t *testing.T) {
	test_utils.InitTestProvider(t, test_utils.MyAnimeList(), test_utils.MyAnimeListMutation())

	malWrapper := NewWrapper(test_utils.ConfigData.Provider.MalJwt, util.NewLogger())

	mId := 51179
	progress := 2
	status := MediaListStatusWatching

	err := malWrapper.UpdateAnimeListStatus(&AnimeListStatusParams{
		Status:             &status,
		NumEpisodesWatched: &progress,
	}, mId)

	if err != nil {
		t.Fatalf("error while fetching media, %v", err)
	}
}
