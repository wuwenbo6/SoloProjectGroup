package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	PythonPath    string `json:"python_path"`
	NodePath      string `json:"node_path"`
	GoPath        string `json:"go_path"`
	ShellPath     string `json:"shell_path"`
	DefaultEditor string `json:"default_editor"`
	SyncRemote    string `json:"sync_remote"`
	SyncBranch    string `json:"sync_branch"`
	GitRemote     string `json:"git_remote"`
	GitBranch     string `json:"git_branch"`
	AutoSync      bool   `json:"auto_sync"`
	RunTimeout    int    `json:"run_timeout"`
	DefaultTheme  string `json:"default_theme"`
}

func getConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	configDir := filepath.Join(home, ".snippets")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(configDir, "config.json"), nil
}

func Load() (*Config, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return &Config{}, err
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := &Config{
				SyncBranch: "main",
				GitBranch:  "main",
				RunTimeout: 30,
			}
			applyDefaultEditors(cfg)
			return cfg, nil
		}
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	if config.SyncBranch == "" {
		config.SyncBranch = "main"
	}
	if config.GitBranch == "" {
		config.GitBranch = "main"
	}
	if config.RunTimeout == 0 {
		config.RunTimeout = 30
	}
	if config.DefaultEditor == "" {
		applyDefaultEditors(&config)
	}

	return &config, nil
}

func applyDefaultEditors(cfg *Config) {
	if editor := os.Getenv("EDITOR"); editor != "" {
		cfg.DefaultEditor = editor
	} else if editor := os.Getenv("VISUAL"); editor != "" {
		cfg.DefaultEditor = editor
	} else {
		cfg.DefaultEditor = "vi"
	}
}

func (c *Config) Save() error {
	configPath, err := getConfigPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}
