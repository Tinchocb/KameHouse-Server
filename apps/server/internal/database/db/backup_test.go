package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBackupCreaArchivoVerificadoYRota(t *testing.T) {
	db := openSettingsTestDB(t)
	db.sqlitePath = filepath.Join(t.TempDir(), "origen.db") // solo debe ser distinto de vacío/:memory:
	dir := t.TempDir()

	// Backups viejos que la rotación debe podar (el nombre lleva el timestamp).
	for _, name := range []string{"kamehouse-backup-2020-01-01_00-00-00.db", "kamehouse-backup-2020-01-02_00-00-00.db"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("viejo"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	res, err := db.Backup(dir, 2)
	if err != nil {
		t.Fatalf("Backup: %v", err)
	}
	if res.SizeBytes == 0 {
		t.Fatal("el backup está vacío")
	}
	if err := verifyBackupIntegrity(res.Path); err != nil {
		t.Fatalf("el backup recién creado no pasa la verificación: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 2 {
		t.Fatalf("la rotación debía dejar 2 backups, hay %d", len(entries))
	}
}

func TestVerifyBackupIntegrityRechazaArchivoCorrupto(t *testing.T) {
	path := filepath.Join(t.TempDir(), "corrupto.db")
	if err := os.WriteFile(path, []byte("esto no es una base SQLite, solo basura de relleno para ocupar espacio"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyBackupIntegrity(path); err == nil {
		t.Fatal("un archivo corrupto no debería pasar la verificación")
	}
}

func TestVerifyBackupIntegrityNoCreaArchivoInexistente(t *testing.T) {
	path := filepath.Join(t.TempDir(), "no-existe.db")
	if err := verifyBackupIntegrity(path); err == nil {
		t.Fatal("un backup inexistente no debería pasar la verificación")
	}
	if _, err := os.Stat(path); err == nil {
		t.Fatal("la verificación no debe crear el archivo (modo solo lectura)")
	}
}
