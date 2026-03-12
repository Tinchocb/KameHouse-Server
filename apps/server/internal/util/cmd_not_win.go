//go:build !windows

package util

import (
	"context"
	"os/exec"
	"syscall"
)

func NewCmd(arg string, args ...string) *exec.Cmd {
	var cmd *exec.Cmd
	if len(args) == 0 {
		cmd = exec.Command(arg)
	} else {
		cmd = exec.Command(arg, args...)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd
}

func NewCmdCtx(ctx context.Context, arg string, args ...string) *exec.Cmd {
	var cmd *exec.Cmd
	if len(args) == 0 {
		cmd = exec.CommandContext(ctx, arg)
	} else {
		cmd = exec.CommandContext(ctx, arg, args...)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd
}
