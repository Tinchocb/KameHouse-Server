package dto

// SourceType is a typed string that identifies the origin of a playable media source.
// Using a named type (rather than plain string) prevents silent failures from magic-string
// mismatches when the frontend parses the JSON badge field.
type SourceType string

const (
	// SourceTypeLocal indicates a file served from the local filesystem.
	SourceTypeLocal SourceType = "local"
)

