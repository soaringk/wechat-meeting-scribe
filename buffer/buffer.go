package buffer

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/alphadose/haxmap"
	"github.com/soaringk/wechat-meeting-scribe/config"
)

type BufferedMessage struct {
	ID        string
	Timestamp time.Time
	Sender    string
	Content   string
	RoomTopic string
}

type roomData struct {
	mu              sync.Mutex
	messages        []BufferedMessage
	lastSummaryTime time.Time
}

type MessageBuffer struct {
	rooms *haxmap.Map[string, *roomData]
}

func New() *MessageBuffer {
	return &MessageBuffer{
		rooms: haxmap.New[string, *roomData](),
	}
}

func (b *MessageBuffer) getOrCreateRoom(roomTopic string) *roomData {
	room, ok := b.rooms.Get(roomTopic)
	if !ok {
		room = &roomData{}
		b.rooms.Set(roomTopic, room)
	}
	return room
}

func (b *MessageBuffer) Add(msg BufferedMessage) {
	room := b.getOrCreateRoom(msg.RoomTopic)
	room.mu.Lock()
	defer room.mu.Unlock()

	room.messages = append(room.messages, msg)

	if len(room.messages) > config.AppConfig.MaxBufferSize {
		removeCount := len(room.messages) - config.AppConfig.MaxBufferSize
		room.messages = room.messages[removeCount:]
		log.Printf("[Buffer] Removed %d old messages from room '%s' (max size: %d)",
			removeCount, msg.RoomTopic, config.AppConfig.MaxBufferSize)
	}

	log.Printf("[Buffer] Message added to room '%s'. Total: %d", msg.RoomTopic, len(room.messages))
}

func (b *MessageBuffer) GetRoomTopics() []string {
	topics := make([]string, 0)
	b.rooms.ForEach(func(topic string, _ *roomData) bool {
		topics = append(topics, topic)
		return true
	})
	return topics
}

func (b *MessageBuffer) Clear(roomTopic string) {
	room, ok := b.rooms.Get(roomTopic)
	if !ok {
		return
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	count := len(room.messages)
	room.messages = nil
	room.lastSummaryTime = time.Now()
	log.Printf("[Buffer] Cleared %d messages from room '%s'", count, roomTopic)
}

func (b *MessageBuffer) ShouldSummarize(roomTopic string, triggeredByKeyword bool) bool {
	room, ok := b.rooms.Get(roomTopic)
	if !ok {
		return false
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	if len(room.messages) < config.AppConfig.SummaryTrigger.MinMessagesForSummary {
		log.Printf("[Buffer] Not enough messages in room '%s' for summary (%d/%d)",
			roomTopic, len(room.messages), config.AppConfig.SummaryTrigger.MinMessagesForSummary)
		return false
	}

	if triggeredByKeyword {
		log.Printf("[Buffer] Summary triggered by keyword in room '%s'", roomTopic)
		return true
	}

	if config.AppConfig.SummaryTrigger.MessageCount > 0 &&
		len(room.messages) >= config.AppConfig.SummaryTrigger.MessageCount {
		log.Printf("[Buffer] Summary triggered by message count in room '%s' (%d/%d)",
			roomTopic, len(room.messages), config.AppConfig.SummaryTrigger.MessageCount)
		return true
	}

	if config.AppConfig.SummaryTrigger.IntervalMinutes > 0 {
		if !room.lastSummaryTime.IsZero() {
			minutesSinceLast := time.Since(room.lastSummaryTime).Minutes()
			if minutesSinceLast >= float64(config.AppConfig.SummaryTrigger.IntervalMinutes) {
				log.Printf("[Buffer] Summary triggered by time interval in room '%s' (%.1f/%d minutes)",
					roomTopic, minutesSinceLast, config.AppConfig.SummaryTrigger.IntervalMinutes)
				return true
			}
		}
	}

	return false
}

func (b *MessageBuffer) FormatMessagesForLLM(roomTopic string) []string {
	room, ok := b.rooms.Get(roomTopic)
	if !ok {
		return []string{}
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	formatted := make([]string, len(room.messages))
	for i, msg := range room.messages {
		timeStr := msg.Timestamp.Format("15:04")
		formatted[i] = fmt.Sprintf("[%s] %s: %s", timeStr, msg.Sender, msg.Content)
	}
	return formatted
}

type Stats struct {
	Count        int
	FirstMessage *time.Time
	LastMessage  *time.Time
	Participants map[string]bool
}

func (b *MessageBuffer) GetStats(roomTopic string) Stats {
	room, ok := b.rooms.Get(roomTopic)
	if !ok {
		return Stats{
			Count:        0,
			Participants: make(map[string]bool),
		}
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	stats := Stats{
		Count:        len(room.messages),
		Participants: make(map[string]bool),
	}

	if len(room.messages) > 0 {
		first := room.messages[0].Timestamp
		last := room.messages[len(room.messages)-1].Timestamp
		stats.FirstMessage = &first
		stats.LastMessage = &last

		for _, msg := range room.messages {
			stats.Participants[msg.Sender] = true
		}
	}

	return stats
}
