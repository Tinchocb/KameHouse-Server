package anime

import "kamehouse/internal/database/models/dto"

// Type aliases to re-export dto types into the anime package.
// This allows existing code throughout the anime package that references
// LocalFile, LocalFileType, etc. to continue working without qualification.
// Note: All methods on LocalFile are defined in dto/localfile_methods.go.
type LocalFile = dto.LocalFile
type LocalFileType = dto.LocalFileType
type LocalFileMetadata = dto.LocalFileMetadata
type LocalFileParsedData = dto.LocalFileParsedData

// Constant aliases for LocalFileType values used throughout the anime package.
const (
	LocalFileTypeMain    = dto.LocalFileTypeMain
	LocalFileTypeSpecial = dto.LocalFileTypeSpecial
	LocalFileTypeNC      = dto.LocalFileTypeNC
)

// Function aliases for dto constructors used throughout the anime package.
var NewLocalFile = dto.NewLocalFile
