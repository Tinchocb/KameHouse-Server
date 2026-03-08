package extension_repo

import (
	"fmt"
	"kamehouse/internal/extension"
	"kamehouse/internal/util"
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Anime Torrent provider
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) loadExternalAnimeTorrentProviderExtension(ext *extension.Extension) (err error) {
	defer util.HandlePanicInModuleWithError("extension_repo/loadExternalAnimeTorrentProviderExtension", &err)

	switch ext.Language {
	case extension.LanguageJavascript, extension.LanguageTypescript:
		err = r.loadExternalAnimeTorrentProviderExtensionJS(ext, ext.Language)
	default:
		err = fmt.Errorf("unsupported language: %v", ext.Language)
	}

	if err != nil {
		return
	}

	return
}

func (r *Repository) loadExternalAnimeTorrentProviderExtensionJS(ext *extension.Extension, language extension.Language) error {
	return fmt.Errorf("JS extensions are no longer supported")
}
