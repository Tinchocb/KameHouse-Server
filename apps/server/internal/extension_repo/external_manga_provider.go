package extension_repo

import (
	"fmt"
	"kamehouse/internal/extension"
	"kamehouse/internal/util"
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Manga
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) loadExternalMangaExtension(ext *extension.Extension) (err error) {
	defer util.HandlePanicInModuleWithError("extension_repo/loadExternalMangaExtension", &err)

	switch ext.Language {
	case extension.LanguageJavascript, extension.LanguageTypescript:
		err = r.loadExternalMangaExtensionJS(ext, ext.Language)
	}

	if err != nil {
		return
	}

	return
}

func (r *Repository) loadExternalMangaExtensionJS(ext *extension.Extension, language extension.Language) error {
	return fmt.Errorf("JS extensions are no longer supported")
}
