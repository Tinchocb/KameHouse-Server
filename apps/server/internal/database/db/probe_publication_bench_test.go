package db

import "testing"

func BenchmarkProbePublication(b *testing.B) {
	d := openProjectionFixture(b, 1)
	files, err := GetAllLocalFilesRelational(d)
	if err != nil {
		b.Fatal(err)
	}
	b.Run("full_upsert", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			if err := UpsertLocalFileRelationalBatch(d, files); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("probe_owned_columns", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			if updated, err := UpdateLocalFileProbe(b.Context(), d, files[0]); err != nil || !updated {
				b.Fatalf("updated=%t err=%v", updated, err)
			}
		}
	})
}
