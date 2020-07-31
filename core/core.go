package core

import (
	"os"
	"path"
	"strconv"

	log "github.com/gabek/owncast/log"

	"github.com/gabek/owncast/config"
	"github.com/gabek/owncast/core/chat"
	"github.com/gabek/owncast/core/ffmpeg"
	"github.com/gabek/owncast/models"
	"github.com/gabek/owncast/utils"
)

var (
	_stats   *models.Stats
	_storage models.ChunkStorageProvider
)

//Start starts up the core processing
func Start() error {
	resetDirectories()

	if err := setupStats(); err != nil {
		log.Error("failed to setup the stats")
		return err
	}

	if err := setupStorage(); err != nil {
		log.Error("failed to setup the storage")
		return err
	}

	if err := createInitialOfflineState(); err != nil {
		log.Error("failed to create the initial offline state")
		return err
	}

	chat.Setup(ChatListenerImpl{})

	return nil
}

func createInitialOfflineState() error {
	// Provide default files
	if !utils.DoesFileExists("webroot/thumbnail.jpg") {
		if err := utils.Copy("static/logo.png", "webroot/thumbnail.jpg"); err != nil {
			return err
		}
	}

	ffmpeg.ShowStreamOfflineState()

	return nil
}

func resetDirectories() {
	log.Trace("Resetting file directories to a clean slate.")

	// Wipe the public, web-accessible hls data directory
	os.RemoveAll(config.Config.GetPublicHLSSavePath())
	os.RemoveAll(config.Config.GetPrivateHLSSavePath())
	os.MkdirAll(config.Config.GetPublicHLSSavePath(), 0777)
	os.MkdirAll(config.Config.GetPrivateHLSSavePath(), 0777)

	// Remove the previous thumbnail
	os.Remove("webroot/thumbnail.jpg")

	// Create private hls data dirs
	if len(config.Config.VideoSettings.StreamQualities) != 0 {
		for index := range config.Config.VideoSettings.StreamQualities {
			os.MkdirAll(path.Join(config.Config.GetPrivateHLSSavePath(), strconv.Itoa(index)), 0777)
			os.MkdirAll(path.Join(config.Config.GetPublicHLSSavePath(), strconv.Itoa(index)), 0777)
		}
	} else {
		os.MkdirAll(path.Join(config.Config.GetPrivateHLSSavePath(), strconv.Itoa(0)), 0777)
		os.MkdirAll(path.Join(config.Config.GetPublicHLSSavePath(), strconv.Itoa(0)), 0777)
	}
}
