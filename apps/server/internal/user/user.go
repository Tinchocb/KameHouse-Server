package user

import (
	"kamehouse/internal/platforms/platform"
)

const SimulatedUserToken = "SIMULATED"

type User struct {
	Viewer *platform.PlatformUser `json:"viewer"`
	Token  string                 `json:"token"`
	// IsSimulated indicates whether the user is not a real Platform account.
	IsSimulated bool `json:"isSimulated"`
}

func NewSimulatedUser() *User {
	acc := platform.PlatformUser{
		Name:        "User",
		Avatar:      nil,
		BannerImage: nil,
	}
	return &User{
		Viewer:      &acc,
		Token:       SimulatedUserToken,
		IsSimulated: true,
	}
}
