package core

import (
	"kamehouse/internal/constants"
	"kamehouse/internal/util"

	"github.com/Masterminds/semver/v3"
)

// Tours represents all version tours available to highlight changes
var Tours = map[string][]string{
	// Tour version -> [previous version, current version]
	"3.5.0": {"< 3.5.0", "< 3.6.0, >= 3.5.0"},
}

// runMigrations checks the previous version and runs any necessary migrations based on the version difference.
// This is run synchronously on app startup.
func (a *App) runMigrations() {

	//go func() {
	a.Logger.Debug().Msg("app: Checking for version migrations")
	done := false
	defer func() {
		if done {
			a.Logger.Info().Msg("app: Version migration complete")
		}
	}()
	defer util.HandlePanicThen(func() {
		a.Logger.Error().Msg("app: runMigrations failed")
	})

	previousVersion, err := semver.NewVersion(a.previousVersion)
	if err != nil {
		a.Logger.Error().Err(err).Msg("app: Failed to parse previous version")
		return
	}

	if a.previousVersion != constants.Version {

		hasUpdated := util.VersionIsOlderThan(a.previousVersion, constants.Version)

		// handle tours
		if hasUpdated {
			currVersion, _ := semver.NewVersion(constants.Version)
			if currVersion != nil {
				for tourVersion, tourConstraints := range Tours {
					from := tourConstraints[0]
					to := tourConstraints[1]
					fromC, err := semver.NewConstraint(from)
					if err != nil {
						continue
					}
					toC, err := semver.NewConstraint(to)
					if err != nil {
						continue
					}
					if fromC.Check(previousVersion) && toC.Check(currVersion) {
						a.Logger.Debug().Msgf("app: Tour for %s", tourVersion)
						a.ShowTour = tourVersion
					}
				}
			}
		}

		//-----------------------------------------------------------------------------------------

		//-----------------------------------------------------------------------------------------

		//-----------------------------------------------------------------------------------------

	}
	//}()

}
