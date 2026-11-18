package mediastream

import (
	"context"
	"testing"

	"kamehouse/internal/drive"
	"kamehouse/internal/mkvsubs"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

// Episodio como los de Dragon Ball Z: opening con karaoke, resumen narrado, placa del
// título y recién después el episodio.
func titleCardEpisode(withTitle bool) []mkvtest.Event {
	evs := []mkvtest.Event{
		{StartMs: 12_330, EndMs: 15_080, Style: "Karaoke Español", Text: "Atravieso las nubes"},
		{StartMs: 12_330, EndMs: 15_080, Style: "Karaoke Japones", Text: "Hikaru kumo wo"},
		{StartMs: 97_280, EndMs: 98_810, Style: "Karaoke Español", Text: "¡Comenzando!"},
		{StartMs: 111_160, EndMs: 114_650, Style: "Narrador", Text: "Tan sólo queda un minuto"},
		{StartMs: 161_960, EndMs: 168_240, Style: "Gokuh", Text: "Tengo que acabar con él"},
		{StartMs: 225_160, EndMs: 228_840, Style: "Freeza", Text: "¡No voy a permitirlo!"},
		{StartMs: 280_000, EndMs: 284_000, Style: "Ending Español", Text: "Canción del final"},
	}
	if withTitle {
		evs = append(evs,
			mkvtest.Event{StartMs: 171_460, EndMs: 176_960, Style: "Titulos", Text: "¡El patetismo de Freezer!"},
			// El avance del próximo episodio repite el estilo: no es la placa de este.
			mkvtest.Event{StartMs: 290_000, EndMs: 294_000, Style: "Titulos", Text: "Próximo episodio"},
		)
	}
	return evs
}

// srtEpisode: el SRT del mismo episodio. La letra del opening va en mayúsculas y se repite;
// la placa del título, en mayúsculas, aparece una sola vez.
func srtEpisode(withCapsTitle bool) []mkvtest.Event {
	evs := []mkvtest.Event{
		{StartMs: 52_630, EndMs: 55_220, Text: "CHA-LA HEAD-CHA-LA"},
		{StartMs: 65_020, EndMs: 67_850, Text: "CHA-LA HEAD-CHA-LA"},
		{StartMs: 70_000, EndMs: 73_000, Text: "¡BRILLA EN EL CIELO!"},
		{StartMs: 112_150, EndMs: 117_940, Text: "La batalla ha llegado\na su conclusión."},
		{StartMs: 153_190, EndMs: 154_520, Text: "¡FREEZA!"},
		{StartMs: 219_840, EndMs: 222_550, Text: "Esto sí que no me lo esperaba."},
	}
	if withCapsTitle {
		evs = append(evs, mkvtest.Event{StartMs: 171_670, EndMs: 177_880, Text: "¡FREEZA ES VENCIDO!\nEL TEMIBLE GOLPE DE LA IRA"})
	}
	return evs
}

type titleCardOpts struct {
	ass      []mkvtest.Event
	srt      []mkvtest.Event
	subCues  bool // el índice lista los bloques de subtítulo y hay lectura directa
	noDirect bool
}

func titleCardFx(t *testing.T, fileID string, o titleCardOpts) *synthFx {
	t.Helper()
	tracks := []mkvtest.SynthTrack{{Kind: mkvtest.KindVideo}, {Kind: mkvtest.KindAudio, Lang: "jpn"}}
	if o.srt != nil {
		tracks = append(tracks, mkvtest.SynthTrack{Kind: mkvtest.KindSRT, Events: o.srt})
	}
	if o.ass != nil {
		tracks = append(tracks, mkvtest.SynthTrack{Kind: mkvtest.KindASS, Events: o.ass})
	}
	fx := newSynthFx(t, mkvtest.SynthOptions{Secs: 300, VideoBytesPerSec: 24 << 10, Tracks: tracks, SubtitleCues: o.subCues}, fileID)
	if o.subCues && !o.noDirect {
		size := fx.synth.Size()
		fx.repo.SetDriveDirectSourceFactory(func(context.Context, string) (mkvsubs.Source, error) {
			return drive.NewRangeSource(fx.fd.Fetch, size), nil
		})
	}
	return fx
}

// openOnly abre la sesión (cabecera y Cues) y pone el contador de Drive en cero: abrir lo
// paga cualquier lectura de subtítulos, no la búsqueda de la placa.
func openOnly(t *testing.T, fx *synthFx) {
	t.Helper()
	_, err := fx.repo.driveWindowSession(context.Background(), fx.path)
	require.NoError(t, err)
	fx.fd.Reset()
}

func TestDriveTitleCardByClustersFindsTitleAfterOpening(t *testing.T) {
	fx := titleCardFx(t, "fileTitle1", titleCardOpts{ass: titleCardEpisode(true), srt: srtEpisode(true)})

	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 0)
	require.NoError(t, err)
	require.InDelta(t, 171.46, got.TitleStart, 0.01)
	require.InDelta(t, 98.81, got.SongEnd, 0.01, "fin del karaoke del opening")
}

func TestDriveTitleCardByClustersReadsOnlyUntilTheTitle(t *testing.T) {
	fx := titleCardFx(t, "fileTitle2", titleCardOpts{ass: titleCardEpisode(true), srt: srtEpisode(true)})
	openOnly(t, fx)

	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.InDelta(t, 171.46, got.TitleStart, 0.01)
	require.Zero(t, got.SongEnd, "el opening quedó antes del tramo leído")
	// De 110 s a la placa hay ~62 s de un archivo de 300 s (más el redondeo a bloques).
	require.Less(t, fx.fd.Bytes(), fx.synth.Size()*35/100)

	// El resultado se recuerda: preguntar de nuevo no vuelve a Drive.
	reqs := fx.fd.Reqs()
	again, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.Equal(t, got, again)
	require.Equal(t, reqs, fx.fd.Reqs())
}

// El caso que falló en la biblioteca real: el ASS no subtitula la placa, el SRT sí.
func TestDriveTitleCardFallsBackToCapsTitleInSRT(t *testing.T) {
	for name, subCues := range map[string]bool{"por clusters": false, "por el índice": true} {
		t.Run(name, func(t *testing.T) {
			fx := titleCardFx(t, "fileTitle3"+name[4:6], titleCardOpts{ass: titleCardEpisode(false), srt: srtEpisode(true), subCues: subCues})

			// Con el fin del opening conocido (AniSkip).
			got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
			require.NoError(t, err)
			require.InDelta(t, 171.67, got.TitleStart, 0.01)

			// Sin saberlo: el karaoke del ASS dice dónde terminó, y la letra en mayúsculas
			// del opening (repetida o no) no se confunde con la placa.
			got, err = fx.repo.DriveTitleCard(context.Background(), fx.path, 0)
			require.NoError(t, err)
			require.InDelta(t, 171.67, got.TitleStart, 0.01)
			require.InDelta(t, 98.81, got.SongEnd, 0.01)
		})
	}
}

func TestDriveTitleCardNoneWithoutAnyTitle(t *testing.T) {
	for name, subCues := range map[string]bool{"por clusters": false, "por el índice": true} {
		t.Run(name, func(t *testing.T) {
			fx := titleCardFx(t, "fileTitle4"+name[4:6], titleCardOpts{ass: titleCardEpisode(false), srt: srtEpisode(false), subCues: subCues})
			openOnly(t, fx)

			got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
			require.NoError(t, err)
			require.Equal(t, float64(-1), got.TitleStart)
			// La búsqueda tiene tope: no recorre el episodio entero buscando una placa que no está.
			require.Less(t, fx.fd.Bytes(), fx.synth.Size()*95/100)
		})
	}
}

func TestDriveTitleCardByCuesReadsOnlySubtitleBlocks(t *testing.T) {
	fx := titleCardFx(t, "fileTitle5", titleCardOpts{ass: titleCardEpisode(true), srt: srtEpisode(true), subCues: true})
	openOnly(t, fx)

	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.InDelta(t, 171.46, got.TitleStart, 0.01)
	// Unas pocas líneas de subtítulo: nada que ver con los ~1,5 MiB de video de ese tramo.
	require.Less(t, fx.fd.Bytes(), int64(48<<10))
	require.LessOrEqual(t, fx.fd.Reqs(), int64(16))

	// Otra pregunta sobre lo ya leído (la precarga usa from=0, el reproductor el fin del
	// opening) solo pide a Drive lo que falta.
	fx.fd.Reset()
	fromStart, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 0)
	require.NoError(t, err)
	require.InDelta(t, 171.46, fromStart.TitleStart, 0.01)
	require.InDelta(t, 98.81, fromStart.SongEnd, 0.01)
	firstReqs := fx.fd.Reqs()
	require.Positive(t, firstReqs)

	fx.fd.Reset()
	again, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.Equal(t, got, again)
	require.Zero(t, fx.fd.Reqs())
}

func TestDriveTitleCardWithoutDirectSourceUsesClusters(t *testing.T) {
	fx := titleCardFx(t, "fileTitle6", titleCardOpts{ass: titleCardEpisode(true), srt: srtEpisode(true), subCues: true, noDirect: true})

	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.InDelta(t, 171.46, got.TitleStart, 0.01)
}

func TestDriveTitleCardIgnoresTitlesBeforeFrom(t *testing.T) {
	events := append(titleCardEpisode(true), mkvtest.Event{StartMs: 5_000, EndMs: 9_000, Style: "Titulos", Text: "Cartel previo al opening"})
	fx := titleCardFx(t, "fileTitle7", titleCardOpts{ass: events})

	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.InDelta(t, 171.46, got.TitleStart, 0.01)
}

func TestDriveTitleCardSRTOnlyNeedsKnownOpeningEnd(t *testing.T) {
	fx := titleCardFx(t, "fileTitle8", titleCardOpts{srt: srtEpisode(true)})

	// Sin ASS ni fin de opening conocido no hay de dónde agarrarse: la letra en mayúsculas
	// del opening podría pasar por título.
	got, err := fx.repo.DriveTitleCard(context.Background(), fx.path, 0)
	require.NoError(t, err)
	require.Equal(t, float64(-1), got.TitleStart)

	got, err = fx.repo.DriveTitleCard(context.Background(), fx.path, 110)
	require.NoError(t, err)
	require.InDelta(t, 171.67, got.TitleStart, 0.01)
}

func TestPickTitleCardCapsRules(t *testing.T) {
	srt := func(startMs int64, text string) titleEvent {
		return titleEvent{startMs: startMs, endMs: startMs + 3000, text: text}
	}
	for name, tc := range map[string]struct {
		events []titleEvent
		want   float64
	}{
		"título en mayúsculas":           {[]titleEvent{srt(171_000, "¡GOKU VUELVE A CASA!")}, 171},
		"una sola palabra no es título":  {[]titleEvent{srt(150_000, "¡KAMEHAMEHA!")}, -1},
		"muy corto no es título":         {[]titleEvent{srt(150_000, "NO, NO")}, -1},
		"con minúsculas no es título":    {[]titleEvent{srt(150_000, "¡Goku Vuelve A Casa!")}, -1},
		"una línea repetida no es placa": {[]titleEvent{srt(150_000, "CHA-LA HEAD-CHA-LA"), srt(160_000, "CHA-LA HEAD-CHA-LA")}, -1},
		"gana el primero":                {[]titleEvent{srt(200_000, "SEGUNDO CARTEL GRANDE"), srt(171_000, "¡GOKU VUELVE A CASA!")}, 171},
		"fuera del tope no cuenta":       {[]titleEvent{srt(400_000, "¡GOKU VUELVE A CASA!")}, -1},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.want, pickTitleCard(tc.events, 110_000, 350_000).TitleStart)
		})
	}
}

func TestASSEventStyleKinds(t *testing.T) {
	for style, want := range map[string]string{
		"Titulos":          "title",
		"Títulos":          "title",
		"Titulos-furigana": "title",
		"Episode Title":    "title",
		"Title":            "title",
		"Karaoke Español":  "song",
		"Opening Japones":  "song",
		"Ending 2 Español": "song",
		"OP":               "song",
		"Narrador":         "",
		"Default":          "",
		"Gotenks":          "",
		"Subtitle":         "",
		"Red":              "",
	} {
		got := ""
		switch {
		case titleStyleRe.MatchString(style):
			got = "title"
		case songStyleRe.MatchString(style):
			got = "song"
		}
		require.Equal(t, want, got, style)
	}

	style, text := assEventFields([]byte("12,0,Titulos,,0,0,0,,{\\an8}¡Hola, mundo!"))
	require.Equal(t, "Titulos", style)
	require.Equal(t, "¡Hola, mundo!", text)
	style, _ = assEventFields([]byte("roto"))
	require.Empty(t, style)
}
