package util

import (
	"testing"

	"github.com/Masterminds/semver/v3"
	"github.com/stretchr/testify/require"
)

func TestSemverConstraints(t *testing.T) {

	testCases := []struct {
		name           string
		version        string
		constraints    string
		expectedOutput bool
	}{
		{
			name:           "Version is within constraint",
			version:        "1.2.0",
			constraints:    ">= 1.2.0, <= 1.3.0",
			expectedOutput: true,
		},
		{
			name:           "Updating from 2.0.0",
			version:        "2.0.1",
			constraints:    "< 2.1.0",
			expectedOutput: true,
		},
		{
			name:           "Version is still 2.1.0",
			version:        "2.1.0",
			constraints:    "< 2.1.0",
			expectedOutput: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c, err := semver.NewConstraint(tc.constraints)
			require.NoError(t, err)

			v, err := semver.NewVersion(tc.version)
			require.NoError(t, err)

			output := c.Check(v)
			if output != tc.expectedOutput {
				t.Errorf("Expected output to be %v, got %v for version %s and constraint %s", tc.expectedOutput, output, tc.version, tc.constraints)
			}
		})
	}

}
