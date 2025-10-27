package llm

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync/atomic"

	"github.com/fsnotify/fsnotify"
	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/shared"
	"github.com/soaringk/wechat-meeting-scribe/config"
)

type Service struct {
	client       openai.Client
	model        shared.ChatModel
	systemPrompt atomic.Value
	watcher      *fsnotify.Watcher
	stopWatcher  chan struct{}
}

func (s *Service) loadSystemPrompt() error {
	systemPromptBytes, err := os.ReadFile(config.AppConfig.SystemPromptFile)
	if err != nil {
		return fmt.Errorf("failed to read system prompt: %w", err)
	}

	prompt := strings.TrimSpace(string(systemPromptBytes))
	s.systemPrompt.Store(prompt)

	log.Printf("[LLM] System prompt loaded (%d chars)", len(prompt))
	return nil
}

func (s *Service) getSystemPrompt() string {
	return s.systemPrompt.Load().(string)
}

func New() *Service {
	s := &Service{
		client: openai.NewClient(
			option.WithAPIKey(config.AppConfig.LLMAPIKey),
			option.WithBaseURL(config.AppConfig.LLMBaseURL),
		),
		model:       shared.ChatModel(config.AppConfig.LLMModel),
		stopWatcher: make(chan struct{}),
	}

	if err := s.loadSystemPrompt(); err != nil {
		log.Fatalf("[LLM] Failed to load initial system prompt: %v", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("[LLM] Failed to create file watcher: %v", err)
	}
	s.watcher = watcher

	if err := watcher.Add(config.AppConfig.SystemPromptFile); err != nil {
		watcher.Close()
		log.Fatalf("[LLM] Failed to watch system prompt file: %v", err)
	}

	go func() {
		defer watcher.Close()
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					log.Println("[LLM] File watcher events channel closed")
					return
				}
				if event.Has(fsnotify.Write) {
					log.Printf("[LLM] System prompt file changed, reloading...")
					if err := s.loadSystemPrompt(); err != nil {
						log.Printf("[LLM] Error reloading system prompt: %v", err)
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					log.Println("[LLM] File watcher errors channel closed")
					return
				}
				log.Printf("[LLM] File watcher error: %v", err)
			case <-s.stopWatcher:
				log.Println("[LLM] File watcher stopped")
				return
			}
		}
	}()

	log.Printf("[LLM] File watcher started for: %s", config.AppConfig.SystemPromptFile)
	return s
}

func (s *Service) Close() {
	close(s.stopWatcher)
	if s.watcher != nil {
		s.watcher.Close()
	}
}

func (s *Service) GenerateSummary(ctx context.Context, messages []string) (string, error) {
	systemPrompt := s.getSystemPrompt()

	conversationText := strings.Join(messages, "\n")
	userPrompt := fmt.Sprintf("请为以下群聊消息生成会议纪要：\n\n%s", conversationText)

	log.Printf("[LLM] Sending request to %s...", s.model)

	resp, err := s.client.Chat.Completions.New(
		ctx,
		openai.ChatCompletionNewParams{
			Model: s.model,
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.SystemMessage(systemPrompt),
				openai.UserMessage(userPrompt),
			},
		},
	)

	if err != nil {
		log.Printf("[LLM] Error: %v", err)
		return "", fmt.Errorf("LLM service error: %w", err)
	}

	if len(resp.Choices) == 0 {
		log.Println("[LLM] No content in response")
		return "", fmt.Errorf("no response from LLM")
	}

	content := resp.Choices[0].Message.Content
	log.Printf("[LLM] Response received (%d chars)", len(content))

	return content, nil
}
