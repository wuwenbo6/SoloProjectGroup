# Snippets - Code Snippet Management Tool

A cross-platform command-line tool for managing, running, and backing up code snippets.

## Features

### Core Management
- **Add**: Create new code snippets with title, description, language, category, and tags
- **List**: View all snippets in a tabular format
- **View**: Display detailed information about a specific snippet with syntax highlighting
- **Search**: Search snippets by keyword, category, or tag with Unicode support
- **Edit**: Modify existing snippets with automatic versioning
- **Delete**: Remove unwanted snippets

### Code Execution
- Run code snippets locally with automatic environment detection
- Supports Python virtual environments (venv, conda)
- Supported languages:
  - Python
  - Go
  - JavaScript (Node.js)
  - Shell/Bash

### Syntax Highlighting
- ANSI color coded syntax highlighting in terminal
- Language-specific keyword highlighting
- String and comment coloring
- Number and constant highlighting

### Sharing
- Generate shareable links for code snippets
- Set expiration times for shared snippets (1h, 1d, 7d, 30d, never)
- View shared snippets via share ID
- List and revoke shared links

### Version Management
- Automatic version saving on each edit
- View version history of snippets
- Restore to previous versions
- Syntax highlighted version diff view

### Import/Export
- Export snippets to JSON or Markdown format
- Import snippets from JSON or Markdown files

### Git Backup
- Local Git repository backup
- Push to remote Git repositories for cloud backup
- Windows platform support with proper permission handling
- Automatic index lock cleanup

### Scheduled Auto Backup
- Configure scheduled automatic backups
- Supports multiple intervals (hourly, daily, weekly, custom hours)
- Unix cron job integration and Windows Task Scheduler
- Backup status tracking and logging

## Project Structure

```
p15/
├── cmd/snippets/
│   ├── main.go                    # Entry point
│   └── commands/
│       ├── root.go                # Root command
│       ├── add.go                 # Add snippet
│       ├── list.go                # List snippets
│       ├── view.go                # View snippet
│       ├── search.go              # Search snippets
│       ├── edit.go                # Edit snippet
│       ├── delete.go              # Delete snippet
│       ├── run.go                 # Run snippet
│       ├── export.go              # Export snippets
│       ├── import.go              # Import snippets
│       ├── backup.go              # Git backup
│       ├── share.go               # Share snippets
│       ├── version.go             # Version management
│       └── schedule.go            # Scheduled backup
├── pkg/
│   ├── models/                    # Data models
│   ├── storage/                   # SQLite storage
│   ├── manager/                   # Business logic
│   ├── runner/                    # Code execution (virtual env support)
│   ├── exim/                      # Import/Export
│   ├── backup/                    # Git backup
│   ├── highlight/                 # Syntax highlighting
│   ├── share/                     # Share management
│   └── scheduler/                 # Scheduled backups
├── go.mod                         # Go module file
└── README.md                      # This file
```

## Installation

```bash
go build -o snippets ./cmd/snippets
```

## Usage

### Add a Snippet
```bash
# Interactive mode
snippets add

# With flags
snippets add -t "Hello World" -l Python -c "print('Hello')"
```

### List Snippets
```bash
snippets list
```

### View a Snippet (with Syntax Highlighting)
```bash
snippets view 1
```

### Search Snippets (Supports Chinese tags)
```bash
snippets search "hello"
snippets search -C "工具函数"
snippets search -T "python"
```

### Edit a Snippet (Auto Versioning)
```bash
snippets edit 1
snippets edit 1 -t "New Title"
```

### Delete a Snippet
```bash
snippets delete 1
```

### Run a Snippet (with Virtual Env Support)
```bash
snippets run 1
```

### Manage Versions
```bash
# List all versions
snippets version 1

# View a specific version
snippets version 1 -v 2

# Restore to a previous version
snippets version 1 -r 1
```

### Share a Snippet
```bash
# Share with 1 day expiration
snippets share 1 -e 1d

# Share with never expire
snippets share 1 -e never

# List all shares
snippets share -l

# View a shared snippet
snippets share-view <share-id>

# Revoke a share
snippets share -r <share-id>
```

### Export Snippets
```bash
snippets export -f json -o snippets.json
snippets export -f markdown
```

### Import Snippets
```bash
snippets import snippets.json
snippets import snippets.md
```

### Git Backup
```bash
# Local backup
snippets backup

# With remote repository
snippets backup -R "https://github.com/user/snippets-backup"
```

### Scheduled Auto Backup
```bash
# View current schedule
snippets schedule

# Enable daily backup with remote
snippets schedule --enable -i daily -R "https://github.com/user/snippets-backup"

# Set custom 6 hour interval
snippets schedule -i 6h

# Run backup immediately
snippets schedule --run

# Disable auto backup
snippets schedule --disable
```

## Dependencies

- `github.com/spf13/cobra` - CLI framework
- `github.com/manifoldco/promptui` - Interactive prompts
- `modernc.org/sqlite` - SQLite database (CGO-free)

## Storage

- SQLite database: `~/.snippets/snippets.db`
- Git backup repository: `~/.snippets-backup/` (default)
