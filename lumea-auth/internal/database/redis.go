package database

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"

	"lumea-auth/internal/config"
)

func NewRedis(cfg *config.Config) *redis.Client {
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("failed to parse redis URL: %v", err)
	}

	client := redis.NewClient(opts)

	if err := client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}

	log.Println("✅ Redis connected")
	return client
}
