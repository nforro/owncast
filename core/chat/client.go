package chat

import (
	"encoding/json"
	"fmt"
	"io"
	"time"

	log "github.com/gabek/owncast/log"
	"golang.org/x/net/websocket"

	"github.com/gabek/owncast/models"
	"github.com/gabek/owncast/utils"

	"github.com/teris-io/shortid"
)

const channelBufSize = 100

//Client represents a chat client.
type Client struct {
	ConnectedAt  time.Time
	MessageCount int

	clientID              string // How we identify unique viewers when counting viewer counts.
	socketID              string // How we identify a single websocket client.
	ws                    *websocket.Conn
	ch                    chan models.ChatMessage
	pingch                chan models.PingMessage
	usernameChangeChannel chan models.NameChangeEvent

	doneCh chan bool
}

const (
	CHAT       = "CHAT"
	NAMECHANGE = "NAME_CHANGE"
	PING       = "PING"
	PONG       = "PONG"
)

//NewClient creates a new chat client
func NewClient(ws *websocket.Conn) *Client {
	if ws == nil {
		log.Panicln("ws cannot be nil")
	}

	ch := make(chan models.ChatMessage, channelBufSize)
	doneCh := make(chan bool)
	pingch := make(chan models.PingMessage)
	usernameChangeChannel := make(chan models.NameChangeEvent)

	clientID := utils.GenerateClientIDFromRequest(ws.Request())
	socketID, _ := shortid.Generate()

	return &Client{time.Now(), 0, clientID, socketID, ws, ch, pingch, usernameChangeChannel, doneCh}
}

//GetConnection gets the connection for the client
func (c *Client) GetConnection() *websocket.Conn {
	return c.ws
}

func (c *Client) Write(msg models.ChatMessage) {
	select {
	case c.ch <- msg:
	default:
		_server.remove(c)
		_server.err(fmt.Errorf("client %s is disconnected", c.clientID))
	}
}

//Done marks the client as done
func (c *Client) Done() {
	c.doneCh <- true
}

// Listen Write and Read request via chanel
func (c *Client) Listen() {
	go c.listenWrite()
	c.listenRead()
}

// Listen write request via chanel
func (c *Client) listenWrite() {
	for {
		select {
		// Send a PING keepalive
		case msg := <-c.pingch:
			websocket.JSON.Send(c.ws, msg)
		// send message to the client
		case msg := <-c.ch:
			// log.Println("Send:", msg)
			websocket.JSON.Send(c.ws, msg)
		case msg := <-c.usernameChangeChannel:
			websocket.JSON.Send(c.ws, msg)
		// receive done request
		case <-c.doneCh:
			_server.remove(c)
			c.doneCh <- true // for listenRead method
			return
		}
	}
}

// Listen read request via chanel
func (c *Client) listenRead() {
	for {
		select {

		// receive done request
		case <-c.doneCh:
			_server.remove(c)
			c.doneCh <- true // for listenWrite method
			return

		// read data from websocket connection
		default:
			var data []byte
			err := websocket.Message.Receive(c.ws, &data)
			if err != nil {
				if err == io.EOF {
					c.doneCh <- true
				} else {
					log.Errorln(err)
				}
				return
			}

			var messageTypeCheck map[string]interface{}
			err = json.Unmarshal(data, &messageTypeCheck)
			if err != nil {
				log.Errorln(err)
			}

			messageType := messageTypeCheck["type"]

			if messageType == CHAT {
				c.chatMessageReceived(data)
			} else if messageType == NAMECHANGE {
				c.userChangedName(data)
			}
		}
	}
}

func (c *Client) userChangedName(data []byte) {
	var msg models.NameChangeEvent
	err := json.Unmarshal(data, &msg)
	if err != nil {
		log.Errorln(err)
	}
	msg.Type = NAMECHANGE
	msg.ID = shortid.MustGenerate()
	_server.usernameChanged(msg)
}

func (c *Client) chatMessageReceived(data []byte) {
	var msg models.ChatMessage
	err := json.Unmarshal(data, &msg)
	if err != nil {
		log.Errorln(err)
	}

	id, _ := shortid.Generate()
	msg.ID = id
	msg.Timestamp = time.Now()
	msg.Visible = true

	c.MessageCount++

	msg.ClientID = c.clientID
	_server.SendToAll(msg)
}
