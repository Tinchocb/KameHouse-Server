package db

import (
	"context"
	"testing"

	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
)

// Al añadir setup_pending a una base que ya tenía ajustes: las filas con biblioteca o con
// Drive no vuelven a pedir el asistente; solo la fila vacía (la que creaba el fallo previo)
// lo pide, y la migración lo decide una única vez.
func TestSetupPendingMigracionDecideSoloAlAñadirLaColumna(t *testing.T) {
	cases := []struct {
		name    string
		folders []string
		drive   bool
		want    bool
	}{
		{name: "fila vacía del fallo previo", want: true},
		{name: "con carpeta de biblioteca", folders: []string{"/mnt/media/anime"}, want: false},
		{name: "solo con Google Drive", drive: true, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			l := zerolog.Nop()
			database, err := NewDatabase(context.Background(), t.TempDir(), "setup_pending_migration", &l)
			if err != nil {
				t.Fatalf("NewDatabase: %v", err)
			}
			t.Cleanup(func() {
				database.Shutdown()
				_ = database.Close()
			})

			// Fila ya guardada, como la de una base anterior a la columna.
			stored, err := database.GetStoredSettings()
			if err != nil {
				t.Fatalf("GetStoredSettings: %v", err)
			}
			prev := *stored
			prev.SetupPending = false
			prev.Library.SeriesPaths = tc.folders
			prev.GoogleDrive.Enabled = tc.drive
			if _, err := database.UpsertSettings(&prev); err != nil {
				t.Fatalf("UpsertSettings: %v", err)
			}

			// La base anterior no tenía la columna: se quita y se vuelve a migrar el esquema.
			if err := database.Gorm().Migrator().DropColumn(&models.Settings{}, "setup_pending"); err != nil {
				t.Fatalf("DropColumn: %v", err)
			}
			if err := migrateSchema(context.Background(), database.Gorm(), &l); err != nil {
				t.Fatalf("migrateSchema: %v", err)
			}
			if got := leerSetupPending(t, database); got != tc.want {
				t.Fatalf("tras añadir la columna: setup_pending=%v, se esperaba %v", got, tc.want)
			}

			// La columna ya existe: otra migración no vuelve a decidir sobre las filas.
			if err := database.Gorm().Exec("UPDATE settings SET setup_pending = 0").Error; err != nil {
				t.Fatal(err)
			}
			if err := migrateSchema(context.Background(), database.Gorm(), &l); err != nil {
				t.Fatalf("segunda migrateSchema: %v", err)
			}
			if leerSetupPending(t, database) {
				t.Fatal("la migración solo debe decidir al añadir la columna, no en cada arranque")
			}
		})
	}
}

// leerSetupPending lee setup_pending directamente de la base, no de la caché de ajustes.
func leerSetupPending(t *testing.T, database *Database) bool {
	t.Helper()
	var pending bool
	if err := database.Gorm().Raw("SELECT setup_pending FROM settings WHERE id = 1").Scan(&pending).Error; err != nil {
		t.Fatalf("leer setup_pending: %v", err)
	}
	return pending
}
