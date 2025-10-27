package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/soaringk/wechat-meeting-scribe/bot"
	"github.com/soaringk/wechat-meeting-scribe/config"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	b := bot.New()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Printf("\n\n🛑 Received %v, shutting down gracefully...", sig)
		b.Stop()
		os.Exit(0)
	}()

	if err := b.Start(); err != nil {
		log.Fatalf("Fatal error: %v", err)
	}
}
