package models

import (
	"database/sql"
	"database/sql/driver"
	"reflect"
	"testing"
)

func TestCommaSeparatedTypesPreserveStorageSemantics(t *testing.T) {
	for _, tc := range []struct {
		name  string
		src   interface{}
		want  []string
		value driver.Value
	}{
		{"nil", nil, []string{}, nil}, {"empty", "", []string{}, nil},
		{"bytes", []byte("a,b"), []string{"a", "b"}, "a,b"},
		{"empty-elements", "a,,b", []string{"a", "", "b"}, "a,,b"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var paths LibraryPaths
			var strings StringSlice
			for _, scanner := range []sql.Scanner{&paths, &strings} {
				if err := scanner.Scan(tc.src); err != nil {
					t.Fatal(err)
				}
			}
			if !reflect.DeepEqual([]string(paths), tc.want) || !reflect.DeepEqual([]string(strings), tc.want) {
				t.Fatalf("paths=%#v strings=%#v", paths, strings)
			}
			for _, valuer := range []driver.Valuer{paths, strings} {
				got, err := valuer.Value()
				if err != nil || got != tc.value {
					t.Fatalf("value=%v err=%v", got, err)
				}
			}
		})
	}
	paths, strings := LibraryPaths{"keep"}, StringSlice{"keep"}
	for _, scanner := range []sql.Scanner{&paths, &strings} {
		if err := scanner.Scan(123); err == nil {
			t.Fatal("invalid input accepted")
		}
	}
	if paths[0] != "keep" || strings[0] != "keep" {
		t.Fatal("invalid input changed receiver")
	}
}
