package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type SandboxConfig struct {
	Timeout       time.Duration
	MemoryLimitMB int
	EnableNetwork bool
	ReadOnlyFS    bool
	WorkDir       string
}

type SandboxResult struct {
	Output     string
	Error      error
	ExitCode   int
	Timeout    bool
	Duration   time.Duration
}

type Sandbox struct {
	config    SandboxConfig
	language  string
	code      string
	workDir   string
}

func DefaultConfig() SandboxConfig {
	return SandboxConfig{
		Timeout:       30 * time.Second,
		MemoryLimitMB: 512,
		EnableNetwork: false,
		ReadOnlyFS:    false,
	}
}

func NewSandbox(language, code string, config SandboxConfig) *Sandbox {
	return &Sandbox{
		config:   config,
		language: strings.ToLower(language),
		code:     code,
	}
}

func (s *Sandbox) Run() (*SandboxResult, error) {
	startTime := time.Now()

	workDir, err := s.createIsolatedDir()
	if err != nil {
		return nil, fmt.Errorf("failed to create sandbox: %v", err)
	}
	s.workDir = workDir
	defer os.RemoveAll(workDir)

	ctx, cancel := context.WithTimeout(context.Background(), s.config.Timeout)
	defer cancel()

	var result *SandboxResult

	switch s.language {
	case "python":
		result, err = s.runPython(ctx)
	case "go":
		result, err = s.runGo(ctx)
	case "javascript", "js":
		result, err = s.runJavaScript(ctx)
	case "shell", "bash":
		result, err = s.runShell(ctx)
	default:
		return nil, fmt.Errorf("unsupported language: %s", s.language)
	}

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.Timeout = true
			result.Error = fmt.Errorf("execution timed out after %v", s.config.Timeout)
		}
	}

	result.Duration = time.Since(startTime)
	return result, nil
}

func (s *Sandbox) createIsolatedDir() (string, error) {
	tempBase := os.TempDir()
	if s.config.WorkDir != "" {
		tempBase = s.config.WorkDir
	}

	workDir, err := os.MkdirTemp(tempBase, "snippet-sandbox-*")
	if err != nil {
		return "", err
	}

	if runtime.GOOS != "windows" {
		if err := os.Chmod(workDir, 0700); err != nil {
			return "", err
		}
	}

	return workDir, nil
}

func (s *Sandbox) getIsolatedEnv() []string {
	env := []string{
		"HOME=" + s.workDir,
		"USER=" + os.Getenv("USER"),
		"PATH=" + os.Getenv("PATH"),
		"TMPDIR=" + s.workDir,
		"TEMP=" + s.workDir,
		"TMP=" + s.workDir,
	}

	if !s.config.EnableNetwork {
		env = append(env,
			"http_proxy=",
			"https_proxy=",
			"HTTP_PROXY=",
			"HTTPS_PROXY=",
			"no_proxy=",
		)
	}

	return env
}

func (s *Sandbox) runPython(ctx context.Context) (*SandboxResult, error) {
	pythonCmd := "python3"
	if _, err := exec.LookPath(pythonCmd); err != nil {
		pythonCmd = "python"
		if _, err := exec.LookPath(pythonCmd); err != nil {
			return &SandboxResult{Error: fmt.Errorf("python not found")}, err
		}
	}

	codeFile := filepath.Join(s.workDir, "snippet.py")
	if err := os.WriteFile(codeFile, []byte(s.code), 0600); err != nil {
		return &SandboxResult{Error: err}, err
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, pythonCmd, "-S", "-E", codeFile)
	cmd.Dir = s.workDir
	cmd.Env = s.getIsolatedEnv()
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n[STDERR]\n" + stderr.String()
	}

	return &SandboxResult{
		Output:   output,
		ExitCode: exitCode,
		Error:    err,
	}, nil
}

func (s *Sandbox) runJavaScript(ctx context.Context) (*SandboxResult, error) {
	nodeCmd := "node"
	if _, err := exec.LookPath(nodeCmd); err != nil {
		return &SandboxResult{Error: fmt.Errorf("node not found")}, err
	}

	codeFile := filepath.Join(s.workDir, "snippet.js")
	if err := os.WriteFile(codeFile, []byte(s.code), 0600); err != nil {
		return &SandboxResult{Error: err}, err
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, nodeCmd, "--no-deprecation", "--no-warnings", codeFile)
	cmd.Dir = s.workDir
	cmd.Env = s.getIsolatedEnv()
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n[STDERR]\n" + stderr.String()
	}

	return &SandboxResult{
		Output:   output,
		ExitCode: exitCode,
		Error:    err,
	}, nil
}

func (s *Sandbox) runGo(ctx context.Context) (*SandboxResult, error) {
	goCmd := "go"
	if _, err := exec.LookPath(goCmd); err != nil {
		return &SandboxResult{Error: fmt.Errorf("go not found")}, err
	}

	codeFile := filepath.Join(s.workDir, "snippet.go")
	if err := os.WriteFile(codeFile, []byte(s.code), 0600); err != nil {
		return &SandboxResult{Error: err}, err
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, goCmd, "run", codeFile)
	cmd.Dir = s.workDir
	cmd.Env = s.getIsolatedEnv()
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n[STDERR]\n" + stderr.String()
	}

	return &SandboxResult{
		Output:   output,
		ExitCode: exitCode,
		Error:    err,
	}, nil
}

func (s *Sandbox) runShell(ctx context.Context) (*SandboxResult, error) {
	shellCmd := "/bin/bash"
	if runtime.GOOS == "windows" {
		shellCmd = "cmd.exe"
	}
	if _, err := exec.LookPath(shellCmd); err != nil {
		return &SandboxResult{Error: fmt.Errorf("shell not found")}, err
	}

	codeFile := filepath.Join(s.workDir, "snippet.sh")
	if err := os.WriteFile(codeFile, []byte(s.code), 0600); err != nil {
		return &SandboxResult{Error: err}, err
	}

	var stdout, stderr bytes.Buffer
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, shellCmd, "/c", codeFile)
	} else {
		cmd = exec.CommandContext(ctx, shellCmd, "--noprofile", "--norc", "-e", codeFile)
	}
	cmd.Dir = s.workDir
	cmd.Env = s.getIsolatedEnv()
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
	}

	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n[STDERR]\n" + stderr.String()
	}

	return &SandboxResult{
		Output:   output,
		ExitCode: exitCode,
		Error:    err,
	}, nil
}
