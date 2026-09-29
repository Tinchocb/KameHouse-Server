package dto

type (
	AutoSelectPreference string
)

const (
	AutoSelectPreferenceNeutral AutoSelectPreference = "neutral"
	AutoSelectPreferencePrefer  AutoSelectPreference = "prefer"
	AutoSelectPreferenceAvoid   AutoSelectPreference = "avoid"
	AutoSelectPreferenceOnly    AutoSelectPreference = "only"
	AutoSelectPreferenceNever   AutoSelectPreference = "never"
)
