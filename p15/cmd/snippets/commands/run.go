package commands

import (
	"fmt"
	"regexp"
	"strconv"
	"snippets/pkg/config"
	"snippets/pkg/runner"
	"snippets/pkg/sandbox"
	"time"

	"github.com/spf13/cobra"
)

var (
	runPythonPath string
	runNodePath   string
	runGoPath     string
	runShellPath  string
	runCheckDeps  bool
	runSandbox    bool
	runTimeout    int
	runNetwork    bool
)

var runCmd = &cobra.Command{
	Use:   "run [id]",
	Short: "Run a code snippet",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("invalid ID: %s", args[0])
		}

		snippet, err := manager.GetSnippet(id)
		if err != nil {
			return err
		}
		if snippet == nil {
			return fmt.Errorf("snippet #%d not found", id)
		}

		cfg, _ := config.Load()

		if runCheckDeps {
			deps := DetectDependencies(snippet.Code, snippet.Language)
			if len(deps) > 0 {
				fmt.Println("Detected dependencies:")
				for _, dep := range deps {
					fmt.Printf("  - %s\n", dep)
				}
				fmt.Println()
			}
		}

		fmt.Printf("Running snippet #%d: %s (%s)...\n\n",
		snippet.ID, snippet.Title, snippet.Language)

	if runSandbox {
		return runInSandbox(snippet.Code, snippet.Language)
	}

	r := runner.NewRunner(snippet.Language, snippet.Code)

	if runPythonPath != "" {
		r.SetPythonPath(runPythonPath)
	} else if cfg.PythonPath != "" {
		r.SetPythonPath(cfg.PythonPath)
	}

	if runNodePath != "" {
		r.SetNodePath(runNodePath)
	} else if cfg.NodePath != "" {
		r.SetNodePath(cfg.NodePath)
	}

	if runGoPath != "" {
		r.SetGoPath(runGoPath)
	} else if cfg.GoPath != "" {
		r.SetGoPath(cfg.GoPath)
	}

	if runShellPath != "" {
		r.SetShellPath(runShellPath)
	} else if cfg.ShellPath != "" {
		r.SetShellPath(cfg.ShellPath)
	}

	output, err := r.Run()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	if output != "" {
		fmt.Println("--- Output ---")
		fmt.Println(output)
	}

	return nil
},
}

func DetectDependencies(code, language string) []string {
	var deps []string

	switch language {
	case "python":
		imports := extractPythonImports(code)
		for _, imp := range imports {
			if !isStdlib(imp) {
				deps = append(deps, imp)
			}
		}
	case "javascript", "js":
		imports := extractJSImports(code)
		deps = append(deps, imports...)
	case "go":
		imports := extractGoImports(code)
		deps = append(deps, imports...)
	}

	return deps
}

func isStdlib(pkg string) bool {
	stdLib := map[string]bool{
		"os": true, "sys": true, "math": true, "re": true, "json": true,
		"time": true, "datetime": true, "collections": true, "random": true,
		"string": true, "struct": true, "functools": true, "itertools": true,
		"pathlib": true, "typing": true, "unittest": true, "logging": true,
		"argparse": true, "subprocess": true, "threading": true, "asyncio": true,
		"http": true, "urllib": true, "socket": true, "email": true,
	}
	return stdLib[pkg]
}

func extractPythonImports(code string) []string {
	var imports []string
	seen := make(map[string]bool)

	lines := []string{}
	for _, line := range strings.Split(code, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "import ") {
			parts := strings.SplitN(line, " ", 2)
			if len(parts) > 1 {
				pkg := strings.Split(parts[1], " ")[0]
				pkg = strings.Split(pkg, ",")[0]
				pkg = strings.Split(pkg, ".")[0]
				if !seen[pkg] && pkg != "" {
					imports = append(imports, pkg)
					seen[pkg] = true
				}
			}
		} else if strings.HasPrefix(line, "from ") {
			parts := strings.SplitN(line, " ", 3)
			if len(parts) > 1 {
				pkg := strings.Split(parts[1], ".")[0]
				if !seen[pkg] && pkg != "" {
					imports = append(imports, pkg)
					seen[pkg] = true
				}
			}
		}
	}
	return imports
}

func extractJSImports(code string) []string {
	var imports []string
	seen := make(map[string]bool)

	for _, line := range strings.Split(code, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "import ") {
			if strings.Contains(line, "from ") {
				parts := strings.Split(line, "from ")
				if len(parts) > 1 {
					pkg := strings.Trim(parts[1], `"' ;`)
					if !strings.HasPrefix(pkg, ".") && !seen[pkg] {
						imports = append(imports, pkg)
						seen[pkg] = true
					}
				}
			}
		} else if strings.HasPrefix(line, "const ") || strings.HasPrefix(line, "let ") || strings.HasPrefix(line, "var ") {
			if strings.Contains(line, "require(") {
				parts := strings.SplitN(line, "require(", 2)
				if len(parts) > 1 {
					inner := strings.SplitN(parts[1], ")", 2)[0]
					pkg := strings.Trim(inner, `"' `)
					if !strings.HasPrefix(pkg, ".") && !seen[pkg] {
						imports = append(imports, pkg)
						seen[pkg] = true
					}
				}
			}
		}
	}
	return imports
}

func extractGoImports(code string) []string {
	var imports []string
	seen := make(map[string]bool)

	inImport := false
	for _, line := range strings.Split(code, "\n") {
		line = strings.TrimSpace(line)
		if line == "import (" {
			inImport = true
			continue
		}
		if inImport && line == ")" {
			inImport = false
			continue
		}

		if inImport || strings.HasPrefix(line, "import ") {
			var pkgPath string
			if strings.Contains(line, `"`) {
				parts := strings.SplitN(line, `"`, 3)
				if len(parts) > 1 {
					pkgPath = parts[1]
				}
			}

			if pkgPath != "" && !strings.Contains(pkgPath, "/") {
				pkg := pkgPath
				if !seen[pkg] && !isGoStdlib(pkg) {
					imports = append(imports, pkg)
					seen[pkg] = true
				}
			}
		}
	}
	return imports
}

func isGoStdlib(pkg string) bool {
	return !strings.Contains(pkg, ".")
}

func runInSandbox(code, language string) error {
	config := sandbox.DefaultConfig()
	if runTimeout > 0 {
		config.Timeout = time.Duration(runTimeout) * time.Second
	}
	config.EnableNetwork = runNetwork

	s := sandbox.NewSandbox(language, code, config)
	result, err := s.Run()
	if err != nil {
		return fmt.Errorf("sandbox error: %v", err)
	}

	if result.Timeout {
		fmt.Printf("\033[33m⚠ Execution timed out after %v\033[0m\n", config.Timeout)
	}

	if result.ExitCode != 0 {
		fmt.Printf("\033[31m✗ Exit code: %d\033[0m\n", result.ExitCode)
	} else {
		fmt.Printf("\033[32m✓ Execution successful\033[0m\n")
	}
	fmt.Printf("Duration: %v\n\n", result.Duration)

	if result.Output != "" {
		fmt.Println("--- Output ---")
		fmt.Println(result.Output)
	}

	if result.Error != nil && result.Output == "" {
		fmt.Printf("\nError: %v\n", result.Error)
	}

	return nil
}

func init() {
	runCmd.Flags().StringVar(&runPythonPath, "python-path", "", "Path to Python interpreter")
	runCmd.Flags().StringVar(&runNodePath, "node-path", "", "Path to Node.js interpreter")
	runCmd.Flags().StringVar(&runGoPath, "go-path", "", "Path to Go compiler")
	runCmd.Flags().StringVar(&runShellPath, "shell-path", "", "Path to Shell interpreter")
	runCmd.Flags().BoolVar(&runCheckDeps, "check-deps", true, "Check and display dependencies")
	runCmd.Flags().BoolVar(&runSandbox, "sandbox", false, "Run in isolated sandbox environment")
	runCmd.Flags().IntVar(&runTimeout, "timeout", 30, "Timeout in seconds for sandbox execution")
	runCmd.Flags().BoolVar(&runNetwork, "network", false, "Enable network access in sandbox")
}
