package scanner

import "testing"

func TestResolveDragonBallPath(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		wantID    int
		wantMovie bool
		wantFound bool
	}{
		// Episodios cuyo título contiene palabras de películas: deben quedar en su serie.
		{"DB episodio con 'ataque'", `D:\COLECCION_DB\(1986-1989) Dragon Ball\(1986-08-06) Saga del 21.º Torneo de las Artes Marciales - E024 - El frenético ataque de Krilin.mkv`, 12609, false, true},
		{"DB episodio con 'más fuerte'", `D:\COLECCION_DB\(1986-1989) Dragon Ball\(1989-03-08) Saga del 23.º Torneo de las Artes Marciales - E148 - El hombre más fuerte del mundo.mkv`, 12609, false, true},
		{"DB episodio con 'Dioses'", `D:\COLECCION_DB\(1986-1989) Dragon Ball\(1988-06-15) Saga de Piccolo Daimaō - E115 - Vamos por la misteriosa agua de los Dioses.mkv`, 12609, false, true},
		{"DBZ episodio con 'Super'", `D:\COLECCION_DB\(1989-1996) Dragon Ball Z\(1992-10-21) Saga de Cell - E161 - Super Vegeta corre peligro.mkv`, 12971, false, true},
		{"DBZ episodio con 'Super Shen Long'", `D:\COLECCION_DB\(1989-1996) Dragon Ball Z\(1990-12-19) Saga de Freezer - E072 - Sal de ahi Super Shen Long, y cumple mi deseo!.mkv`, 12971, false, true},
		{"DBZ episodio con 'técnica especial'", `D:\COLECCION_DB\(1989-1996) Dragon Ball Z\(1994-09-21) Saga de Majin Boo - E240 - La técnica especial para Goten y Trunks.mkv`, 12971, false, true},
		{"GT episodio 'Super Gogeta'", `D:\COLECCION_DB\(1996-1997) Dragon Ball GT\(1997-10-22) Saga de los Dragones Malignos - E060 - Super Gogeta.mkv`, 12697, false, true},
		{"DBS episodio en subcarpeta", `(2015-2018) Dragon Ball Super/Episodios/(2017-01-08) Saga de Trunks del Futuro - E073 - ¡La mala suerte de Gohan! ¡¿El Gran Saiyaman tendrá su propia película!.mkv`, 62715, false, true},

		// Películas y especiales.
		{"DBZ película en carpeta de películas", `D:\COLECCION_DB\(1989-1996) Dragon Ball Z\Películas de Dragon Ball Z\(1995-07-15) Dragon Ball Z - El Ataque Del Dragón.mkv`, 39108, true, true},
		{"DB película Shen Long", `(1986-1989) Dragon Ball/Películas de Dragon Ball/(1986-12-20) Dragon Ball - La leyenda de Shen Long.mkv`, 39144, true, true},
		{"DB especial", `(1986-1989) Dragon Ball/Especiales de Dragon Ball/(1988-06-08) Dragon Ball - Seguridad vial con Goku.mkv`, 39322, true, true},
		{"DBZ OVA", `(1989-1996) Dragon Ball Z/OVAs de Dragon Ball Z/(2008-09-21) Dragon Ball Z - Goku y sus amigos regresan.mkv`, 38594, true, true},

		// Sin carpeta: un episodio numerado nunca es película.
		{"Episodio suelto numerado", `Dragon Ball Z - E024 - El ataque de los Saiyajin.mkv`, 12971, false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, movie, found := ResolveDragonBallPath(tt.path)
			if found != tt.wantFound || id != tt.wantID || movie != tt.wantMovie {
				t.Errorf("ResolveDragonBallPath(%q) = (%d, %v, %v), want (%d, %v, %v)",
					tt.path, id, movie, found, tt.wantID, tt.wantMovie, tt.wantFound)
			}
		})
	}
}

func TestIsMovieFolderName(t *testing.T) {
	for name, want := range map[string]bool{
		"Películas de Dragon Ball Z": true,
		"Especiales de Dragon Ball":  true,
		"OVAs de Dragon Ball Z":      true,
		"Movies":                     true,
		"Downloads":                  false,
		"Episodios":                  false,
		"(1989-1996) Dragon Ball Z":  false,
		"Nova":                       false,
	} {
		if got := IsMovieFolderName(name); got != want {
			t.Errorf("IsMovieFolderName(%q) = %v, want %v", name, got, want)
		}
	}
}
