package container

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
)

var (
	containerIDRegex = regexp.MustCompile(`([a-f0-9]{64})`)
	dockerPrefix     = "docker-"
	kubePrefix       = "kubepods-"
)

func GetContainerID(pid int) string {
	cgroupPath := fmt.Sprintf("/proc/%d/cgroup", pid)
	file, err := os.Open(cgroupPath)
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, "docker") || strings.Contains(line, "kubepods") {
			matches := containerIDRegex.FindStringSubmatch(line)
			if len(matches) > 0 {
				return matches[1][:12]
			}
		}
	}

	return ""
}
