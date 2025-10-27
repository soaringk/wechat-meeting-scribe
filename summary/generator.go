package summary

import (
	"fmt"
	"log"
	"time"

	"github.com/soaringk/wechat-meeting-scribe/buffer"
	"github.com/soaringk/wechat-meeting-scribe/llm"
)

type Generator struct {
	llmService *llm.Service
}

func New() *Generator {
	return &Generator{
		llmService: llm.New(),
	}
}

func (g *Generator) Generate(buf *buffer.MessageBuffer, roomTopic string) (string, error) {
	snapshot := buf.GetSnapshot(roomTopic)

	if snapshot.Count == 0 {
		return fmt.Sprintf("群组「%s」暂无新消息需要总结。", roomTopic), nil
	}

	log.Printf("[Summary] Generating summary for %d messages in room '%s'...", snapshot.Count, roomTopic)
	log.Printf("[Summary] Participants: %d", len(snapshot.Participants))
	if snapshot.FirstMessageTime != nil && snapshot.LastMessageTime != nil {
		log.Printf("[Summary] Time range: %s - %s",
			snapshot.FirstMessageTime.Format("2006-01-02 15:04:05"),
			snapshot.LastMessageTime.Format("2006-01-02 15:04:05"))
	}

	if len(snapshot.FormattedMessages) == 0 {
		return fmt.Sprintf("群组「%s」暂无新消息需要总结。", roomTopic), nil
	}
	summary, err := g.llmService.GenerateSummary(snapshot.FormattedMessages)
	if err != nil {
		log.Printf("[Summary] Error generating summary for room '%s': %v", roomTopic, err)
		return "", fmt.Errorf("生成纪要时出错：%w", err)
	}

	header := g.generateHeader(snapshot, roomTopic)
	fullSummary := fmt.Sprintf("%s\n\n%s\n\n---\n📊 统计信息：共 %d 条消息，%d 位参与者",
		header, summary, snapshot.Count, len(snapshot.Participants))

	log.Printf("[Summary] Summary generated successfully for room '%s' (%d chars)", roomTopic, len(fullSummary))
	return fullSummary, nil
}

func (g *Generator) generateHeader(snapshot buffer.Snapshot, roomTopic string) string {
	now := time.Now()
	dateStr := now.Format("2006年1月2日 Monday")

	timeRange := ""
	if snapshot.FirstMessageTime != nil && snapshot.LastMessageTime != nil {
		start := snapshot.FirstMessageTime.Format("15:04")
		end := snapshot.LastMessageTime.Format("15:04")
		timeRange = fmt.Sprintf("%s - %s", start, end)
	}

	return fmt.Sprintf("# 🤖 %s 会议纪要\n📅 日期：%s\n⏰ 时间：%s\n", roomTopic, dateStr, timeRange)
}
