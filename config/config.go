package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type SummaryTriggerConfig struct {
	IntervalMinutes      int
	MessageCount         int
	Keyword              string
	MinMessagesForSummary int
}

type Config struct {
	LLMAPIKey        string
	LLMBaseURL       string
	LLMModel         string
	SystemPromptFile string
	BotName          string
	TargetRooms      []string
	SummaryTrigger   SummaryTriggerConfig
	MaxBufferSize    int
}

var AppConfig *Config

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("Warning: Invalid integer value for %s, using default %d", key, defaultValue)
		return defaultValue
	}
	return intValue
}

func Load() error {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	AppConfig = &Config{
		LLMAPIKey:        getEnv("LLM_API_KEY", ""),
		LLMBaseURL:       getEnv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
		LLMModel:         getEnv("LLM_MODEL", "gemini-2.5-flash"),
		SystemPromptFile: getEnv("SYSTEM_PROMPT_FILE", "system_prompt.txt"),
		BotName:          getEnv("BOT_NAME", "meeting-minutes-bot"),
		SummaryTrigger: SummaryTriggerConfig{
			IntervalMinutes:      getEnvInt("SUMMARY_INTERVAL_MINUTES", 30),
			MessageCount:         getEnvInt("SUMMARY_MESSAGE_COUNT", 50),
			Keyword:              getEnv("SUMMARY_KEYWORD", "@bot 总结"),
			MinMessagesForSummary: getEnvInt("MIN_MESSAGES_FOR_SUMMARY", 5),
		},
		MaxBufferSize: getEnvInt("MAX_BUFFER_SIZE", 200),
	}

	targetRoomsStr := getEnv("TARGET_ROOMS", "")
	if targetRoomsStr != "" {
		rooms := strings.Split(targetRoomsStr, ",")
		for _, room := range rooms {
			trimmed := strings.TrimSpace(room)
			if trimmed != "" {
				AppConfig.TargetRooms = append(AppConfig.TargetRooms, trimmed)
			}
		}
	}

	return nil
}

func Validate() error {
	if AppConfig.LLMAPIKey == "" {
		return fmt.Errorf("LLM_API_KEY is required")
	}

	log.Println("✓ Configuration loaded successfully")
	log.Printf("  - Bot name: %s", AppConfig.BotName)
	log.Printf("  - LLM base URL: %s", AppConfig.LLMBaseURL)
	log.Printf("  - LLM model: %s", AppConfig.LLMModel)
	log.Printf("  - System prompt file: %s", AppConfig.SystemPromptFile)

	if len(AppConfig.TargetRooms) > 0 {
		log.Printf("  - Target rooms: %s", strings.Join(AppConfig.TargetRooms, ", "))
	} else {
		log.Println("  - Target rooms: All rooms")
	}

	log.Println("  - Summary triggers:")
	if AppConfig.SummaryTrigger.IntervalMinutes > 0 {
		log.Printf("    • Time-based: every %d minutes", AppConfig.SummaryTrigger.IntervalMinutes)
	} else {
		log.Println("    • Time-based: disabled")
	}

	if AppConfig.SummaryTrigger.MessageCount > 0 {
		log.Printf("    • Volume-based: every %d messages", AppConfig.SummaryTrigger.MessageCount)
	} else {
		log.Println("    • Volume-based: disabled")
	}

	if AppConfig.SummaryTrigger.Keyword != "" {
		log.Printf("    • Keyword: %s", AppConfig.SummaryTrigger.Keyword)
	} else {
		log.Println("    • Keyword: disabled")
	}

	return nil
}
