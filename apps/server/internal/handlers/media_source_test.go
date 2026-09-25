package handlers

import (
	"testing"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
)

func TestSourceRulesFilter(t *testing.T) {
	files := []*dto.LocalFile{
		{Path: `D:\DBZ\ep1.mkv`, MediaID: 1},
		{Path: "gdrive://abc/ep1.mkv", MediaID: 1},
		{Path: `D:\DB\ep1.mkv`, MediaID: 2},
		{Path: "gdrive://def/ep1.mkv", MediaID: 2},
		nil,
	}
	paths := func(lfs []*dto.LocalFile) []string {
		out := []string{}
		for _, lf := range lfs {
			if lf != nil {
				out = append(out, lf.Path)
			}
		}
		return out
	}

	cases := []struct {
		name  string
		rules sourceRules
		want  []string
	}{
		{"todo encendido, sin preferencias",
			sourceRules{localEnabled: true, cloudEnabled: true},
			[]string{`D:\DBZ\ep1.mkv`, "gdrive://abc/ep1.mkv", `D:\DB\ep1.mkv`, "gdrive://def/ep1.mkv"}},
		{"disco local apagado",
			sourceRules{localEnabled: false, cloudEnabled: true},
			[]string{"gdrive://abc/ep1.mkv", "gdrive://def/ep1.mkv"}},
		{"nube pausada",
			sourceRules{localEnabled: true, cloudEnabled: false},
			[]string{`D:\DBZ\ep1.mkv`, `D:\DB\ep1.mkv`}},
		{"serie 1 solo local, serie 2 solo nube",
			sourceRules{localEnabled: true, cloudEnabled: true, prefs: map[int]string{1: db.MediaSourceLocal, 2: db.MediaSourceCloud}},
			[]string{`D:\DBZ\ep1.mkv`, "gdrive://def/ep1.mkv"}},
		{"preferencia por un origen apagado vuelve a automático",
			sourceRules{localEnabled: true, cloudEnabled: false, prefs: map[int]string{1: db.MediaSourceCloud}},
			[]string{`D:\DBZ\ep1.mkv`, `D:\DB\ep1.mkv`}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := paths(tc.rules.filter(files))
			if len(got) != len(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("got %v, want %v", got, tc.want)
				}
			}
		})
	}
}

func TestSourceRulesEffective(t *testing.T) {
	r := sourceRules{localEnabled: false, cloudEnabled: true, prefs: map[int]string{1: db.MediaSourceLocal, 2: db.MediaSourceCloud}}
	if got := r.effective(1); got != db.MediaSourceAuto {
		t.Errorf("local apagado: effective(1) = %q, want auto", got)
	}
	if got := r.effective(2); got != db.MediaSourceCloud {
		t.Errorf("effective(2) = %q, want cloud", got)
	}
	if got := r.effective(3); got != db.MediaSourceAuto {
		t.Errorf("sin preferencia = %q, want auto", got)
	}
}
