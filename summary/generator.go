package summary

import (
	"context"
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

func (g *Generator) Generate(ctx context.Context, buf *buffer.MessageBuffer, roomTopic string) (string, error) {
	snapshot := buf.GetSnapshot(roomTopic)

	if snapshot.Count == 0 {
		return fmt.Sprintf("群组「%s」暂无新消息需要总结。", roomTopic), nil
	}

	log.Printf("[Summary] Generating summary for %d messages in room '%s'...", snapshot.Count, roomTopic)
	log.Printf("[Summary] Participants: %d", len(snapshot.Participants))
	if snapshot.FirstMsgTime != nil && snapshot.LastMsgTime != nil {
		log.Printf("[Summary] Time range: %s - %s",
			snapshot.FirstMsgTime.Format("2006-01-02 15:04:05"),
			snapshot.LastMsgTime.Format("2006-01-02 15:04:05"))
	}

	if len(snapshot.FormattedMsg) == 0 {
		return fmt.Sprintf("群组「%s」暂无新消息需要总结。", roomTopic), nil
	}
	summary, err := g.llmService.GenerateSummary(ctx, snapshot.FormattedMsg)
	if err != nil {
		log.Printf("[Summary] Error generating summary for room '%s': %v", roomTopic, err)
		return "", fmt.Errorf("failed to generate summary: %w", err)
	}

	header := g.generateHeader(snapshot, roomTopic)
	fullSummary := fmt.Sprintf("%s\n\n%s\n\n---\n📊 统计信息：共 %d 条消息，%d 位参与者",
		header, summary, snapshot.Count, len(snapshot.Participants))

	log.Printf("[Summary] Summary generated successfully for room '%s' (%d chars)", roomTopic, len(fullSummary))
	return fullSummary, nil
}

func (g *Generator) Close() {
	g.llmService.Close()
}

func (g *Generator) generateHeader(snapshot buffer.Snapshot, roomTopic string) string {
	now := time.Now()
	dateStr := now.Format("2006年1月2日 Monday")

	timeRange := "N/A"
	if snapshot.FirstMsgTime != nil && snapshot.LastMsgTime != nil {
		start := snapshot.FirstMsgTime.Format("15:04")
		end := snapshot.LastMsgTime.Format("15:04")
		timeRange = fmt.Sprintf("%s - %s", start, end)
	}

	return fmt.Sprintf("# 🤖 %s 会议纪要\n📅 日期：%s\n⏰ 时间：%s\n", roomTopic, dateStr, timeRange)
}
