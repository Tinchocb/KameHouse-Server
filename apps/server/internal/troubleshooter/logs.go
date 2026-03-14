package troubleshooter

import (
	"kamehouse/internal/database/db"

	"github.com/rs/zerolog"
)

type Troubleshooter struct {
	logger   *zerolog.Logger
	database *db.Database
}

type NewTroubleshooterOptions struct {
	Logger   *zerolog.Logger
	Database *db.Database
}

func NewTroubleshooter(opts *NewTroubleshooterOptions) *Troubleshooter {
	return &Troubleshooter{
		logger:   opts.Logger,
		database: opts.Database,
	}
}

func (t *Troubleshooter) GetLogs(level string, module string) ([]string, error) {
	return []string{}, nil
}

func (t *Troubleshooter) Check() error {
	return nil
}

type AppState string
type Module string
type Level string
