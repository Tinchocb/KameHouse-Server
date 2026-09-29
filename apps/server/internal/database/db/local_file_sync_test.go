package db

import (
	"fmt"
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func syncTestFiles(dir string, from, to int) []*dto.LocalFile {
	files := make([]*dto.LocalFile, 0, to-from)
	for i := from; i < to; i++ {
		files = append(files, &dto.LocalFile{Path: fmt.Sprintf("%s/ep%04d.mkv", dir, i), Name: fmt.Sprintf("ep%04d.mkv", i)})
	}
	return files
}

// Regresión: el borrado de "lo que ya no está" iba con `NOT IN` partido en
// bloques de 500, y cada bloque borraba lo que estaba en los demás: con más de
// 500 archivos un escaneo parcial vaciaba el directorio entero.
func TestSyncPartialLocalFilesNoBorraLoQueSigueExistiendo(t *testing.T) {
	db := openSettingsTestDB(t)

	// "/lib/ab" empieza igual que "/lib/a" pero es otra carpeta.
	seed := append(syncTestFiles("/lib/a", 0, 1200), syncTestFiles("/lib/b", 0, 3)...)
	seed = append(seed, syncTestFiles("/lib/ab", 0, 2)...)
	if err := UpsertLocalFileRelationalBatch(db, seed); err != nil {
		t.Fatal(err)
	}

	// El escaneo de /lib/a encuentra 1100 de los 1200 (desaparecen los últimos 100).
	if err := SyncPartialLocalFilesRelational(db, syncTestFiles("/lib/a", 0, 1100), []string{"/lib/a"}); err != nil {
		t.Fatal(err)
	}

	var inA, inB int64
	db.gormdb.Model(&models.LocalFile{}).Where("path LIKE ?", "/lib/a/%").Count(&inA)
	db.gormdb.Model(&models.LocalFile{}).Where("path LIKE ?", "/lib/b/%").Count(&inB)
	if inA != 1100 {
		t.Fatalf("archivos en /lib/a = %d, se esperaban 1100", inA)
	}
	if inB != 3 {
		t.Fatalf("archivos en /lib/b = %d, el escaneo parcial de /lib/a no debía tocarlos (3)", inB)
	}

	var sibling int64
	db.gormdb.Model(&models.LocalFile{}).Where("path LIKE ?", "/lib/ab/%").Count(&sibling)
	if sibling != 2 {
		t.Fatalf("archivos en /lib/ab = %d: el escaneo de /lib/a no debía tocar una carpeta con nombre parecido (2)", sibling)
	}

	var gone int64
	db.gormdb.Model(&models.LocalFile{}).Where("path = ?", "/lib/a/ep1150.mkv").Count(&gone)
	if gone != 0 {
		t.Fatal("un archivo que ya no existe debía borrarse")
	}
}
