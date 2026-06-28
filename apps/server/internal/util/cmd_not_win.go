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

// KillCmd kills the entire process group on POSIX systems
func KillCmd(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err == nil {
		return syscall.Kill(-pgid, syscall.SIGKILL)
	}
	return cmd.Process.Kill()
}
