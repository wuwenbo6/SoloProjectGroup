package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"syscall"
	"time"
)

func ExecuteShellCommand(command string, timeout int) (string, error) {
	if timeout == 0 {
		timeout = 300
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", command)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
		}
	} else {
		cmd = exec.Command("sh", "-c", command)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Setpgid: true,
		}
	}

	done := make(chan error, 1)
	var output []byte
	var outputErr error

	go func() {
		output, outputErr = cmd.CombinedOutput()
		done <- outputErr
	}()

	select {
	case <-ctx.Done():
		if cmd.Process != nil {
			if runtime.GOOS == "windows" {
				syscall.GenerateConsoleCtrlEvent(syscall.CTRL_BREAK_EVENT, uint32(cmd.Process.Pid))
				time.Sleep(100 * time.Millisecond)
				cmd.Process.Kill()
			} else {
				syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
			}
		}
		return string(output) + fmt.Sprintf("\nTask timed out after %d seconds, process terminated", timeout), ctx.Err()
	case err := <-done:
		if err != nil {
			return string(output), err
		}
		return string(output), nil
	}
}
