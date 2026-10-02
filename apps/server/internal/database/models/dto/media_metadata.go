package dto

// CharacterRole defines the role of a character within a saga.
type CharacterRole string

const (
	RoleProtagonist CharacterRole = "Protagonist"
	RoleAntagonist  CharacterRole = "Antagonist"
	RoleSupporting  CharacterRole = "Supporting"
	RoleBackground  CharacterRole = "Background"
)

// EpisodeType defines the classification of an episode.
type EpisodeType string

const (
	EpisodeTypeCanon  EpisodeType = "Canon"
	EpisodeTypeFiller EpisodeType = "Filler"
	EpisodeTypeHyped  EpisodeType = "Hyped" // Premium/Climax episodes
)

// CharacterDTO represents a key character within a specific saga.
type CharacterDTO struct {
	Name      string        `json:"name"`
	RoleTag   CharacterRole `json:"roleTag"` // e.g., "Antagonist", "Defensor"
	AvatarURL string        `json:"avatarUrl"`
}

// SubSagaDTO represents a sub-saga or story beat within a saga.
type SubSagaDTO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	EpisodeRange string `json:"episodeRange"` // e.g., "1-6"
	StartEp      int    `json:"startEp"`
	EndEp        int    `json:"endEp"`
}

// SagaDTO represents a story arc or saga within a series.
type SagaDTO struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	EpisodeRange  string         `json:"episodeRange"` // e.g., "1-39"
	StartEp       int            `json:"startEp"`
	EndEp         int            `json:"endEp"`
	Description   string         `json:"description"`
	IsFiller      bool           `json:"isFiller"` // True if the entire saga is filler (e.g., Garlic Jr.)
	CanonStatus   string         `json:"canonStatus"`
	Antagonists   []string       `json:"antagonists"`
	KeyEvents     []string       `json:"keyEvents"`
	NewCharacters []string       `json:"newCharacters"`
	KeyCharacters []CharacterDTO `json:"keyCharacters"`
	SubSagas      []SubSagaDTO   `json:"subSagas,omitempty"`
}
