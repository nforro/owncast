package main

import (
	"flag"
	"fmt"

	log "github.com/gabek/owncast/log"
	"github.com/sirupsen/logrus"

	"github.com/gabek/owncast/config"
	"github.com/gabek/owncast/core"
	"github.com/gabek/owncast/router"
	"github.com/gabek/owncast/termui"
)

// the following are injected at build-time
var (
	//GitCommit is the commit which this version of owncast is running
	GitCommit = "unknown"
	//BuildVersion is the version
	BuildVersion = "0.0.0"
	//BuildType is the type of build
	BuildType = "localdev"
)

func main() {
	configureLogging()

	log.Infoln(getVersion())

	configFile := flag.String("configFile", "config.yaml", "Config File full path. Defaults to current folder")
	chatDbFile := flag.String("chatDatabase", "", "Path to the chat database file.")
	enableDebugOptions := flag.Bool("enableDebugFeatures", false, "Enable additional debugging options.")
	enableVerboseLogging := flag.Bool("enableVerboseLogging", false, "Enable additional logging.")

	flag.Parse()

	if *enableDebugOptions {
		logrus.SetReportCaller(true)
	}

	if *enableVerboseLogging {
		logrus.SetLevel(logrus.TraceLevel)
	} else {
		logrus.SetLevel(logrus.InfoLevel)
	}

	if err := config.Load(*configFile, getVersion()); err != nil {
		panic(err)
	}
	config.Config.EnableDebugFeatures = *enableDebugOptions

	if *chatDbFile != "" {
		config.Config.ChatDatabaseFilePath = *chatDbFile
	} else if config.Config.ChatDatabaseFilePath == "" {
		config.Config.ChatDatabaseFilePath = "chat.db"
	}

	go termui.Setup(getVersion())

	// starts the core
	if err := core.Start(); err != nil {
		log.Error("failed to start the core package")
		panic(err)
	}

	if err := router.Start(); err != nil {
		log.Error("failed to start/run the router")
		panic(err)
	}
}

//getVersion gets the version string
func getVersion() string {
	return fmt.Sprintf("Owncast v%s-%s (%s)", BuildVersion, BuildType, GitCommit)
}

func configureLogging() {
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})
}
