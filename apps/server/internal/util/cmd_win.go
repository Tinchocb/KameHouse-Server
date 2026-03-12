//go:build windows

package util

import (
	"context"
	"os/exec"
	"syscall"
)

// NewCmd creates a new exec.Cmd object with the given arguments.
// Since for Windows, the app is built as a GUI application, we need to hide the console windows launched when running commands.
func NewCmd(arg string, args ...string) *exec.Cmd {
	//cmdPrompt := "C:\\Windows\\system32\\cmd.exe"
	//cmdArgs := append([]string{"/c", arg}, args...)
	//cmd := exec.Command(cmdPrompt, cmdArgs...)
	//cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd := exec.Command(arg, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000,
		//HideWindow:    true,
	}
	return cmd
}

func NewCmdCtx(ctx context.Context, arg string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, arg, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// 0x08000000 = CREATE_NO_WINDOW
		// 0x00000200 = CREATE_NEW_PROCESS_GROUP
		CreationFlags: 0x08000200,
	}
	return cmd
}
