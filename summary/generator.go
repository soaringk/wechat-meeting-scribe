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
	stats := buf.GetStats(roomTopic)

	if stats.Count == 0 {
		return fmt.Sprintf("群组「%s」暂无新消息需要总结。", roomTopic), nil
	}

	log.Printf("[Summary] Generating summary for %d messages in room '%s'...", stats.Count, roomTopic)
	log.Printf("[Summary] Participants: %d", len(stats.Participants))
	if stats.FirstMessage != nil && stats.LastMessage != nil {
		log.Printf("[Summary] Time range: %s - %s",
			stats.FirstMessage.Format("2006-01-02 15:04:05"),
			stats.LastMessage.Format("2006-01-02 15:04:05"))
	}

	formattedMessages := buf.FormatMessagesForLLM(roomTopic)
	summary, err := g.llmService.GenerateSummary(formattedMessages)
	if err != nil {
		log.Printf("[Summary] Error generating summary for room '%s': %v", roomTopic, err)
		return "", fmt.Errorf("生成纪要时出错：%w", err)
	}

	header := g.generateHeader(stats, roomTopic)
	fullSummary := fmt.Sprintf("%s\n\n%s\n\n---\n📊 统计信息：共 %d 条消息，%d 位参与者",
		header, summary, stats.Count, len(stats.Participants))

	log.Printf("[Summary] Summary generated successfully for room '%s' (%d chars)", roomTopic, len(fullSummary))
	return fullSummary, nil
}

func (g *Generator) generateHeader(stats buffer.Stats, roomTopic string) string {
	now := time.Now()
	dateStr := now.Format("2006年1月2日 Monday")

	timeRange := ""
	if stats.FirstMessage != nil && stats.LastMessage != nil {
		start := stats.FirstMessage.Format("15:04")
		end := stats.LastMessage.Format("15:04")
		timeRange = fmt.Sprintf("%s - %s", start, end)
	}

	return fmt.Sprintf("# 🤖 %s 会议纪要\n📅 日期：%s\n⏰ 时间：%s\n", roomTopic, dateStr, timeRange)
}
