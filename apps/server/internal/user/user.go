package user

import (
	"errors"
	"kamehouse/internal/database/models"
	"kamehouse/internal/platforms/platform"

	"github.com/goccy/go-json"
)

const SimulatedUserToken = "SIMULATED"

type User struct {
	Viewer *platform.PlatformUser `json:"viewer"`
	Token  string                 `json:"token"`
	// IsSimulated indicates whether the user is not a real AniList account.
	IsSimulated bool `json:"isSimulated"`
}

// NewUser creates a new User entity from a models.User
// This is returned to the client
func NewUser(model *models.Account) (*User, error) {
	if model == nil {
		return nil, errors.New("account is nil")
	}
	var acc platform.PlatformUser
	if err := json.Unmarshal(model.Viewer, &acc); err != nil {
		return nil, err
	}
	return &User{
		Viewer: &acc,
		Token:  model.Token,
	}, nil
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
