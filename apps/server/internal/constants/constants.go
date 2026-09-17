package constants

import (
	"kamehouse/internal/util"
	"time"
)

const (
	Version        = "3.5.0"
	VersionName    = "Hakumei"
	GcTime         = time.Minute * 30
	ConfigFileName = "config.toml"

	MovieIDOffset = 1_000_000
)

var InternalMetadataURL = util.Decode("aHR0cHM6Ly9hbmltZS5jbGFwLmluZw==")
