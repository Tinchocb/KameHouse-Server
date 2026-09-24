package codegen

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

const nullabilitySrc = `package sample

import (
	"encoding/json"
	"time"
)

type Tags []string

type Inner struct {
	Name string ` + "`json:\"name\"`" + `
}

type Sample struct {
	Items     []string        ` + "`json:\"items\"`" + `
	ItemsOpt  []string        ` + "`json:\"itemsOpt,omitempty\"`" + `
	Ptr       *Inner          ` + "`json:\"ptr\"`" + `
	PtrOpt    *Inner          ` + "`json:\"ptrOpt,omitempty\"`" + `
	Dict      map[string]int  ` + "`json:\"dict\"`" + `
	Raw       json.RawMessage ` + "`json:\"raw\"`" + `
	Value     Inner           ` + "`json:\"value\"`" + `
	ValueZero Inner           ` + "`json:\"valueZero,omitzero\"`" + `
	When      time.Time       ` + "`json:\"when\"`" + `
	Alias     Tags            ` + "`json:\"alias\"`" + `
	Str       string          ` + "`json:\"str\"`" + `
	StrOpt    string          ` + "`json:\"strOpt,string,omitempty\"`" + `
}
`

func TestTsFieldModifiers(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.go")
	require.NoError(t, os.WriteFile(path, []byte(nullabilitySrc), 0o644))
	info, err := os.Stat(path)
	require.NoError(t, err)
	structs, err := getGoStructsFromFile(path, info)
	require.NoError(t, err)

	byName := map[string]*GoStruct{}
	for _, s := range structs {
		byName[s.Package+"."+s.Name] = s
	}
	sample := byName["sample.Sample"]
	require.NotNil(t, sample)

	type mods struct{ optional, nullable bool }
	want := map[string]mods{
		"items":     {false, true},
		"itemsOpt":  {true, false},
		"ptr":       {false, true},
		"ptrOpt":    {true, false},
		"dict":      {false, true},
		"raw":       {false, true},
		"value":     {false, false},
		"valueZero": {true, false},
		"when":      {false, false},
		"alias":     {false, true},
		"str":       {false, false},
		"strOpt":    {true, false},
	}
	for _, f := range sample.Fields {
		exp, ok := want[f.JsonName]
		require.True(t, ok, f.JsonName)
		opt, null := tsFieldModifiers(f, byName)
		require.Equal(t, exp, mods{opt, null}, f.JsonName)
	}
}
