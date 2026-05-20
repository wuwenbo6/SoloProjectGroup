package mq

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/video-transcoder/internal/config"
)

const (
	QueueTranscode = "transcode_tasks"
	QueueMerge     = "merge_tasks"
	DLXExchange    = "dlx_exchange"
)

const (
	MessageTTL        = 10 * 60 * 1000
	MaxPriority uint8 = 5
)

type TranscodeMessage struct {
	TaskID       string  `json:"task_id"`
	SegmentID    int     `json:"segment_id"`
	InputPath    string  `json:"input_path"`
	OutputPath   string  `json:"output_path"`
	Codec        string  `json:"codec"`
	Duration     float64 `json:"duration"`
	StartTime    float64 `json:"start_time"`
	TargetBitrate string  `json:"target_bitrate,omitempty"`
	MaxBitrate   string  `json:"max_bitrate,omitempty"`
	Complexity    float64 `json:"complexity,omitempty"`
	WatermarkJSON string `json:"watermark_json,omitempty"`
	CropJSON     string `json:"crop_json,omitempty"`
}

type MergeMessage struct {
	TaskID        string `json:"task_id"`
	SegmentCount  int    `json:"segment_count"`
	Codec         string `json:"codec"`
	Duration      float64 `json:"duration"`
	OutputFormat  string `json:"output_format,omitempty"`
	ConfigJSON    string `json:"config_json,omitempty"`
}

type RabbitMQClient struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

func NewRabbitMQClient(cfg *config.Config) (*RabbitMQClient, error) {
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	client := &RabbitMQClient{
		conn:    conn,
		channel: ch,
	}

	if err := client.declareQueues(); err != nil {
		return nil, err
	}

	log.Println("RabbitMQ client initialized successfully")
	return client, nil
}

func (r *RabbitMQClient) declareQueues() error {
	err := r.channel.ExchangeDeclare(
		DLXExchange,
		"fanout",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLX exchange: %w", err)
	}

	queueArgs := amqp.Table{
		"x-dead-letter-exchange": DLXExchange,
		"x-message-ttl":          int32(MessageTTL),
		"x-max-priority":         MaxPriority,
	}

	queues := []string{QueueTranscode, QueueMerge}
	for _, queue := range queues {
		_, err := r.channel.QueueDeclare(
			queue,
			true,
			false,
			false,
			false,
			queueArgs,
		)
		if err != nil {
			return fmt.Errorf("failed to declare queue %s: %w", queue, err)
		}
	}

	dlqTranscode := QueueTranscode + "_dlq"
	_, err = r.channel.QueueDeclare(
		dlqTranscode,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLQ transcode: %w", err)
	}
	_, err = r.channel.QueueBind(dlqTranscode, "#", DLXExchange, false, nil)
	if err != nil {
		return fmt.Errorf("failed to bind DLQ transcode: %w", err)
	}

	dlqMerge := QueueMerge + "_dlq"
	_, err = r.channel.QueueDeclare(
		dlqMerge,
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to declare DLQ merge: %w", err)
	}
	_, err = r.channel.QueueBind(dlqMerge, "#", DLXExchange, false, nil)
	if err != nil {
		return fmt.Errorf("failed to bind DLQ merge: %w", err)
	}

	return nil
}

func (r *RabbitMQClient) PublishTranscodeTask(ctx context.Context, msg TranscodeMessage) error {
	return r.PublishTranscodeTaskWithPriority(ctx, msg, MaxPriority/2)
}

func (r *RabbitMQClient) PublishTranscodeTaskWithPriority(ctx context.Context, msg TranscodeMessage, priority uint8) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal transcode message: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = r.channel.PublishWithContext(ctx,
		"",
		QueueTranscode,
		false,
		false,
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         body,
			Priority:     priority,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish transcode task: %w", err)
	}

	log.Printf("Published transcode task: task=%s, segment=%d, priority=%d", msg.TaskID, msg.SegmentID, priority)
	return nil
}

func (r *RabbitMQClient) PublishMergeTask(ctx context.Context, msg MergeMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal merge message: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	err = r.channel.PublishWithContext(ctx,
		"",
		QueueMerge,
		false,
		false,
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         body,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish merge task: %w", err)
	}

	log.Printf("Published merge task: task=%s", msg.TaskID)
	return nil
}

func (r *RabbitMQClient) ConsumeTranscodeTasks(handler func(TranscodeMessage) error) error {
	msgs, err := r.channel.Consume(
		QueueTranscode,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to consume transcode tasks: %w", err)
	}

	forever := make(chan struct{})

	go func() {
		for d := range msgs {
			var msg TranscodeMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				log.Printf("Failed to unmarshal transcode message: %v", err)
				d.Nack(false, false)
				continue
			}

			if err := handler(msg); err != nil {
				log.Printf("Failed to process transcode task: %v", err)
				d.Nack(false, true)
				continue
			}

			d.Ack(false)
		}
	}()

	log.Println("Started consuming transcode tasks")
	<-forever
	return nil
}

func (r *RabbitMQClient) ConsumeMergeTasks(handler func(MergeMessage) error) error {
	msgs, err := r.channel.Consume(
		QueueMerge,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to consume merge tasks: %w", err)
	}

	forever := make(chan struct{})

	go func() {
		for d := range msgs {
			var msg MergeMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				log.Printf("Failed to unmarshal merge message: %v", err)
				d.Nack(false, false)
				continue
			}

			if err := handler(msg); err != nil {
				log.Printf("Failed to process merge task: %v", err)
				d.Nack(false, true)
				continue
			}

			d.Ack(false)
		}
	}()

	log.Println("Started consuming merge tasks")
	<-forever
	return nil
}

func (r *RabbitMQClient) GetMessage(ctx context.Context, queueName string) ([]byte, bool, error) {
	msg, ok, err := r.channel.Get(queueName, true)
	if err != nil {
		return nil, false, err
	}
	if !ok {
		return nil, false, nil
	}
	return msg.Body, true, nil
}

func (r *RabbitMQClient) Close() error {
	if err := r.channel.Close(); err != nil {
		return err
	}
	return r.conn.Close()
}
