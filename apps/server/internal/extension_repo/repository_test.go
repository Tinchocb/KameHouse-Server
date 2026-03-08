package extension_repo_test

import (
	"kamehouse/internal/events"
	"kamehouse/internal/extension_repo"
	"kamehouse/internal/util"
	"testing"
)

func getRepo(t *testing.T) *extension_repo.Repository {
	logger := util.NewLogger()
	wsEventManager := events.NewMockWSEventManager(logger)

	return extension_repo.NewRepository(&extension_repo.NewRepositoryOptions{
		Logger:         logger,
		ExtensionDir:   "testdir",
		WSEventManager: wsEventManager,
	})
}
