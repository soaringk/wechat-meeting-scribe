package bot

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/eatmoreapple/openwechat"
	"github.com/soaringk/wechat-meeting-scribe/buffer"
	"github.com/soaringk/wechat-meeting-scribe/config"
	"github.com/soaringk/wechat-meeting-scribe/summary"
)

type Bot struct {
	bot          *openwechat.Bot
	buffer       *buffer.MessageBuffer
	generator    *summary.Generator
	self         *openwechat.Self
	stopTimer    chan bool
	summaryQueue chan string
}

func New() *Bot {
	return &Bot{
		bot:          openwechat.DefaultBot(openwechat.Desktop),
		buffer:       buffer.New(),
		generator:    summary.New(),
		stopTimer:    make(chan bool),
		summaryQueue: make(chan string, 10),
	}
}

func (b *Bot) Start() error {
	log.Println("🤖 Initializing WeChat Meeting Scribe...")

	b.bot.UUIDCallback = openwechat.PrintlnQrcodeUrl

	b.bot.MessageHandler = b.handleMessage

	reloadStorage := openwechat.NewFileHotReloadStorage("storage.json")
	defer reloadStorage.Close()

	log.Println("🚀 Starting bot...")
	log.Println("⏳ Attempting hot login...")

	err := b.bot.PushLogin(reloadStorage, openwechat.NewRetryLoginOption())
	if err != nil {
		log.Printf("❌ Login failed: %v", err)
		return err
	}

	self, err := b.bot.GetCurrentUser()
	if err != nil {
		log.Printf("❌ Failed to get current user: %v", err)
		return err
	}
	b.self = self

	log.Printf("\n✅ User %s logged in successfully!", self.NickName)
	log.Println("   Bot is now active and monitoring messages.")

	go b.summaryWorker()

	if config.AppConfig.SummaryTrigger.IntervalMinutes > 0 {
		b.startIntervalTimer()
	}

	b.bot.Block()
	return nil
}

func (b *Bot) Stop() {
	log.Println("\n🛑 Stopping bot...")
	b.stopIntervalTimer()
	close(b.summaryQueue)
	log.Println("🛑 Bot stopped")
}

func (b *Bot) handleMessage(msg *openwechat.Message) {
	if !msg.IsText() {
		return
	}

	sender, err := msg.Sender()
	if err != nil {
		log.Printf("Error getting message sender: %v", err)
		return
	}

	if !sender.IsGroup() {
		return
	}

	group := openwechat.Group{User: sender}
	groupName := group.NickName

	if !b.isTargetRoom(groupName) {
		return
	}

	senderUser, err := msg.SenderInGroup()
	if err != nil {
		log.Printf("Error getting sender in group: %v", err)
		return
	}

	content := msg.Content
	if strings.TrimSpace(content) == "" {
		return
	}

	bufferedMsg := buffer.BufferedMessage{
		ID:        msg.MsgId,
		Timestamp: time.Now(),
		Sender:    senderUser.NickName,
		Content:   content,
		RoomTopic: groupName,
	}

	b.buffer.Add(bufferedMsg)

	if b.buffer.ShouldSummarize(groupName, b.checkKeywordTrigger(content)) {
		select {
		case b.summaryQueue <- groupName:
		default:
			log.Println("[WARN] summaryQueue is full")
		}
	}
}

func (b *Bot) isTargetRoom(roomName string) bool {
	if len(config.AppConfig.TargetRooms) == 0 {
		return true
	}

	roomNameLower := strings.ToLower(roomName)
	for _, target := range config.AppConfig.TargetRooms {
		if strings.Contains(roomNameLower, strings.ToLower(target)) {
			return true
		}
	}
	return false
}

func (b *Bot) checkKeywordTrigger(text string) bool {
	if config.AppConfig.SummaryTrigger.Keyword == "" {
		return false
	}
	return strings.Contains(text, config.AppConfig.SummaryTrigger.Keyword)
}

func (b *Bot) summaryWorker() {
	for roomTopic := range b.summaryQueue {
		b.generateAndSendSummary(roomTopic)
	}
}

func (b *Bot) generateAndSendSummary(roomTopic string) {
	log.Printf("\n📝 Generating summary for room '%s'...", roomTopic)

	summaryText, err := b.generator.Generate(b.buffer, roomTopic)
	if err != nil {
		log.Printf("❌ Error generating summary for room '%s': %v", roomTopic, err)
		summaryText = fmt.Sprintf("❌ 为「%s」生成会议纪要时出错：%v", roomTopic, err)
	}

	if err := b.sendToSelf(summaryText); err != nil {
		log.Printf("❌ Error sending summary: %v", err)
		return
	}

	if err == nil {
		b.buffer.Clear(roomTopic)
	}

	log.Printf("✅ Summary sent successfully for room '%s'\n", roomTopic)
}

func (b *Bot) sendToSelf(message string) error {
	if b.self == nil {
		return fmt.Errorf("self user not available")
	}

	fileHelper := b.self.FileHelper()
	_, err := fileHelper.SendText(message)
	return err
}

func (b *Bot) startIntervalTimer() {
	intervalMinutes := config.AppConfig.SummaryTrigger.IntervalMinutes
	log.Printf("⏱️  Starting interval timer (%d minutes)", intervalMinutes)

	ticker := time.NewTicker(time.Duration(intervalMinutes) * time.Minute)

	go func() {
		for {
			select {
			case <-ticker.C:
				log.Println("\n⏰ Interval timer triggered")
				roomTopics := b.buffer.GetRoomTopics()
				for _, topic := range roomTopics {
					if b.buffer.ShouldSummarize(topic, false) {
						log.Printf("Processing scheduled summary for room: %s", topic)
						select {
						case b.summaryQueue <- topic:
						default:
						}
					}
				}
			case <-b.stopTimer:
				ticker.Stop()
				log.Println("⏱️  Interval timer stopped")
				return
			}
		}
	}()
}

func (b *Bot) stopIntervalTimer() {
	select {
	case b.stopTimer <- true:
	default:
	}
}
