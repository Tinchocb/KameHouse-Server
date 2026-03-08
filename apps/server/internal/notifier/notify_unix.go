//go:build !windows

package notifier

import (
	"fmt"
	"kamehouse/internal/util"

	"github.com/gen2brain/beeep"
)

// Notify sends a notification to the user.
// This is run in a goroutine.
func (n *Notifier) Notify(id Notification, message string) {
	go func() {
		defer util.HandlePanicThen(func() {})

		n.mu.Lock()
		defer n.mu.Unlock()

		if !n.canProceed(id) {
			return
		}

		err := beeep.Notify(
			fmt.Sprintf("KameHouse: %s", id),
			message,
			n.logoPath,
		)
		if err != nil {
			if n.logger.IsPresent() {
				n.logger.MustGet().Trace().Msgf("notifier: Failed to push notification: %v", err)
			}
		}

		if n.logger.IsPresent() {
			n.logger.MustGet().Trace().Msgf("notifier: Pushed notification: %v", id)
		}
	}()
}
