package cache

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/video-transcoder/internal/config"
)

var Client *redis.Client

func Init(cfg *config.Config) error {
	Client = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Redis connected successfully")
	return nil
}

func GetClient() *redis.Client {
	return Client
}

func SetKey(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return Client.Set(ctx, key, value, expiration).Err()
}

func GetKey(ctx context.Context, key string) (string, error) {
	return Client.Get(ctx, key).Result()
}

func DelKey(ctx context.Context, key string) error {
	return Client.Del(ctx, key).Err()
}

func HSet(ctx context.Context, key, field string, value interface{}) error {
	return Client.HSet(ctx, key, field, value).Err()
}

func HGet(ctx context.Context, key, field string) (string, error) {
	return Client.HGet(ctx, key, field).Result()
}

func HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return Client.HGetAll(ctx, key).Result()
}

func LPush(ctx context.Context, key string, values ...interface{}) error {
	return Client.LPush(ctx, key, values...).Err()
}

func RPop(ctx context.Context, key string) (string, error) {
	return Client.RPop(ctx, key).Result()
}

func LLen(ctx context.Context, key string) (int64, error) {
	return Client.LLen(ctx, key).Result()
}
