package termui

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"

	"github.com/mackerelio/go-osstat/memory"
	"github.com/prometheus/common/log"
)

func getMemoryUsage() uint64 {
	memory, err := memory.Get()
	if err != nil {
		panic(err)
	}

	return memory.Used / 1024 / 1024 /// memory.Total
}

func getCpuUsage() int {
	shellCmd := ""
	if runtime.GOOS == "darwin" {
		shellCmd = `top -l 2 -n 0 -F | egrep -o ' \d*\.\d+% idle' | tail -1 | awk -F% -v prefix="$prefix" '{ printf "%s%.1f\n", prefix, 100 - $1 }'`
	} else {
		panic("cpu usage cmd not defined")
	}

	cmd := exec.Command("bash", "-c", shellCmd)
	out, err := cmd.CombinedOutput()

	if err != nil {
		log.Fatalf("cmd.Run() failed with %s\n", err)
	}

	pct := strings.TrimSpace(string(out))
	result, _ := strconv.ParseFloat(pct, 10)
	return int(result)
}
