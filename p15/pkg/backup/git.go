package backup

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type GitBackup struct {
	repoPath string
}

func runGitCommand(dir string, args ...string) ([]byte, error) {
	var stdout, stderr bytes.Buffer
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if runtime.GOOS == "windows" {
		cmd.Env = append(os.Environ(), "HOME="+os.Getenv("USERPROFILE"))
		cmd.Env = append(cmd.Env, "PATH="+os.Getenv("PATH"))
	}

	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("%w: %s", err, stderr.String())
	}
	return stdout.Bytes(), nil
}

func NewGitBackup(repoPath string) *GitBackup {
	return &GitBackup{repoPath: repoPath}
}

func (g *GitBackup) RepoPath() string {
	return g.repoPath
}

func (g *GitBackup) Clone(url string) error {
	cmd := exec.Command("git", "clone", url, g.repoPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %s", err, string(output))
	}
	return nil
}

func (g *GitBackup) Init() error {
	perm := os.FileMode(0755)
	if runtime.GOOS == "windows" {
		perm = 0777
	}
	if err := os.MkdirAll(g.repoPath, perm); err != nil {
		return err
	}

	_, err := runGitCommand(g.repoPath, "init")
	if err != nil {
		return fmt.Errorf("git init failed: %v", err)
	}

	return nil
}

func (g *GitBackup) AddFile(filename string, content []byte) error {
	filePath := filepath.Join(g.repoPath, filename)
	perm := os.FileMode(0755)
	if runtime.GOOS == "windows" {
		perm = 0777
	}
	if err := os.MkdirAll(filepath.Dir(filePath), perm); err != nil {
		return err
	}

	filePerm := os.FileMode(0644)
	if runtime.GOOS == "windows" {
		filePerm = 0666
	}

	lockFile := filepath.Join(g.repoPath, ".git", "index.lock")
	os.Remove(lockFile)

	return os.WriteFile(filePath, content, filePerm)
}

func (g *GitBackup) Commit(message string) error {
	_, err := runGitCommand(g.repoPath, "add", ".")
	if err != nil {
		return fmt.Errorf("git add failed: %v", err)
	}

	_, err = runGitCommand(g.repoPath, "commit", "-m", message)
	if err != nil {
		if strings.Contains(err.Error(), "nothing to commit") || strings.Contains(err.Error(), "no changes added") {
			return nil
		}
		return fmt.Errorf("git commit failed: %v", err)
	}

	return nil
}

func (g *GitBackup) Push(remote, branch string) error {
	_, err := runGitCommand(g.repoPath, "push", remote, branch)
	if err != nil {
		return fmt.Errorf("git push failed: %v", err)
	}
	return nil
}

func (g *GitBackup) Pull(remote, branch string) error {
	_, err := runGitCommand(g.repoPath, "pull", remote, branch)
	if err != nil {
		return fmt.Errorf("git pull failed: %v", err)
	}
	return nil
}

func (g *GitBackup) SetRemote(name, url string) error {
	_, err := runGitCommand(g.repoPath, "remote", "add", name, url)
	if err != nil {
		_, err = runGitCommand(g.repoPath, "remote", "set-url", name, url)
		if err != nil {
			return fmt.Errorf("git remote set-url failed: %v", err)
		}
	}
	return nil
}

func (g *GitBackup) GetRemoteURL(name string) (string, error) {
	output, err := runGitCommand(g.repoPath, "remote", "get-url", name)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func (g *GitBackup) HasRemote(name string) bool {
	output, err := runGitCommand(g.repoPath, "remote")
	if err != nil {
		return false
	}
	remotes := strings.Fields(string(output))
	for _, r := range remotes {
		if r == name {
			return true
		}
	}
	return false
}

func (g *GitBackup) BackupSnippetsJSON(content []byte) error {
	if err := g.AddFile("snippets.json", content); err != nil {
		return err
	}
	return g.Commit(fmt.Sprintf("Backup snippets at %s", time.Now().Format(time.RFC3339)))
}

func GetDefaultRepoPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		if runtime.GOOS == "windows" {
			homeDir = os.Getenv("USERPROFILE")
			if homeDir == "" {
				return "", err
			}
		} else {
			return "", err
		}
	}
	return filepath.Join(homeDir, ".snippets-backup"), nil
}

func IsGitInstalled() bool {
	_, err := exec.LookPath("git")
	return err == nil
}

func IsGitRepository(path string) bool {
	gitDir := filepath.Join(path, ".git")
	if _, err := os.Stat(gitDir); err == nil {
		return true
	}
	return false
}
