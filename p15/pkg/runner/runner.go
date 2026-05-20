package runner

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type Runner struct {
	language    string
	code        string
	pythonPath  string
	nodePath    string
	goPath      string
	shellPath   string
}

func NewRunner(language, code string) *Runner {
	return &Runner{
		language: strings.ToLower(language),
		code:     code,
	}
}

func (r *Runner) SetPythonPath(path string) {
	r.pythonPath = path
}

func (r *Runner) SetNodePath(path string) {
	r.nodePath = path
}

func (r *Runner) SetGoPath(path string) {
	r.goPath = path
}

func (r *Runner) SetShellPath(path string) {
	r.shellPath = path
}

func (r *Runner) SetCustomInterpreter(language, path string) {
	switch strings.ToLower(language) {
	case "python":
		r.pythonPath = path
	case "javascript", "js":
		r.nodePath = path
	case "go":
		r.goPath = path
	case "shell", "bash":
		r.shellPath = path
	}
}

func (r *Runner) Run() (string, error) {
	switch r.language {
	case "python":
		return r.runPython()
	case "go":
		return r.runGo()
	case "javascript", "js":
		return r.runJavaScript()
	case "shell", "bash":
		return r.runShell()
	default:
		return "", fmt.Errorf("unsupported language: %s", r.language)
	}
}

func (r *Runner) findPythonVenv() string {
	if r.pythonPath != "" {
		if _, err := os.Stat(r.pythonPath); err == nil {
			return r.pythonPath
		}
	}

	venvNames := []string{"venv", ".venv", "env", ".env", ".python-version"}
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}

	for _, name := range venvNames {
		venvPath := filepath.Join(cwd, name)
		if name == ".python-version" {
			data, err := os.ReadFile(venvPath)
			if err == nil {
				versionPath := strings.TrimSpace(string(data))
				if filepath.IsAbs(versionPath) {
					if _, err := os.Stat(versionPath); err == nil {
						return versionPath
					}
				}
			}
			continue
		}

		if _, err := os.Stat(venvPath); err == nil {
			var pythonPath string
			if runtime.GOOS == "windows" {
				pythonPath = filepath.Join(venvPath, "Scripts", "python.exe")
			} else {
				pythonPath = filepath.Join(venvPath, "bin", "python")
			}
			if _, err := os.Stat(pythonPath); err == nil {
				return pythonPath
			}
		}
	}

	condaEnv := os.Getenv("CONDA_PREFIX")
	if condaEnv != "" {
		var pythonPath string
		if runtime.GOOS == "windows" {
			pythonPath = filepath.Join(condaEnv, "python.exe")
		} else {
			pythonPath = filepath.Join(condaEnv, "bin", "python")
		}
		if _, err := os.Stat(pythonPath); err == nil {
			return pythonPath
		}
	}

	home, _ := os.UserHomeDir()
	pyenvPath := filepath.Join(home, ".pyenv", "shims", "python")
	if _, err := os.Stat(pyenvPath); err == nil {
		return pyenvPath
	}

	return ""
}

func (r *Runner) runPython() (string, error) {
	pythonCmd := r.findPythonVenv()
	if pythonCmd == "" {
		pythonCmd = "python3"
		if _, err := exec.LookPath(pythonCmd); err != nil {
			pythonCmd = "python"
			if _, err := exec.LookPath(pythonCmd); err != nil {
				return "", fmt.Errorf("python not found in PATH, try setting --python-path")
			}
		}
	}

	tmpDir, err := os.MkdirTemp("", "snippet-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, "snippet.py")
	if err := os.WriteFile(tmpFile, []byte(r.code), 0644); err != nil {
		return "", err
	}

	cmd := exec.Command(pythonCmd, tmpFile)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8")
	return r.executeCommand(cmd)
}

func (r *Runner) runGo() (string, error) {
	goCmd := "go"
	if _, err := exec.LookPath(goCmd); err != nil {
		return "", fmt.Errorf("go not found in PATH")
	}

	tmpDir, err := os.MkdirTemp("", "snippet-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, "main.go")
	if err := os.WriteFile(tmpFile, []byte(r.code), 0644); err != nil {
		return "", err
	}

	cmd := exec.Command(goCmd, "run", tmpFile)
	return r.executeCommand(cmd)
}

func (r *Runner) runJavaScript() (string, error) {
	nodeCmd := "node"
	if _, err := exec.LookPath(nodeCmd); err != nil {
		return "", fmt.Errorf("node.js not found in PATH")
	}

	tmpDir, err := os.MkdirTemp("", "snippet-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, "snippet.js")
	if err := os.WriteFile(tmpFile, []byte(r.code), 0644); err != nil {
		return "", err
	}

	cmd := exec.Command(nodeCmd, tmpFile)
	return r.executeCommand(cmd)
}

func (r *Runner) runShell() (string, error) {
	var shellCmd string
	switch runtime.GOOS {
	case "windows":
		shellCmd = "cmd.exe"
	default:
		shellCmd = "bash"
		if _, err := exec.LookPath(shellCmd); err != nil {
			shellCmd = "sh"
		}
	}

	tmpDir, err := os.MkdirTemp("", "snippet-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, "snippet.sh")
	if err := os.WriteFile(tmpFile, []byte(r.code), 0755); err != nil {
		return "", err
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command(shellCmd, "/c", tmpFile)
	} else {
		cmd = exec.Command(shellCmd, tmpFile)
	}
	return r.executeCommand(cmd)
}

func (r *Runner) executeCommand(cmd *exec.Cmd) (string, error) {
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += "STDERR: " + stderr.String()
	}

	return output, err
}

func CheckEnvironment(language string) error {
	switch strings.ToLower(language) {
	case "python":
		if _, err := exec.LookPath("python3"); err != nil {
			if _, err := exec.LookPath("python"); err != nil {
				return fmt.Errorf("python not found in PATH")
			}
		}
	case "go":
		if _, err := exec.LookPath("go"); err != nil {
			return fmt.Errorf("go not found in PATH")
		}
	case "javascript", "js":
		if _, err := exec.LookPath("node"); err != nil {
			return fmt.Errorf("node.js not found in PATH")
		}
	case "shell", "bash":
		if _, err := exec.LookPath("bash"); err != nil {
			if _, err := exec.LookPath("sh"); err != nil {
				return fmt.Errorf("shell not found in PATH")
			}
		}
	default:
		return fmt.Errorf("unsupported language: %s", language)
	}
	return nil
}
