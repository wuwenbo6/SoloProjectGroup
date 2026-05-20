package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/video-transcoder/internal/config"
)

type MinIOClient struct {
	client         *minio.Client
	inputBucket    string
	outputBucket   string
	segmentsBucket string
}

func NewMinIOClient(cfg *config.Config) (*MinIOClient, error) {
	client, err := minio.New(cfg.MinIOEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIOAccessKey, cfg.MinIOSecretKey, ""),
		Secure: cfg.MinIOUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	mc := &MinIOClient{
		client:         client,
		inputBucket:    cfg.MinIOInputBucket,
		outputBucket:   cfg.MinIOOutputBucket,
		segmentsBucket: cfg.MinIOSegmentsBucket,
	}

	if err := mc.ensureBuckets(); err != nil {
		return nil, err
	}

	log.Println("MinIO client initialized successfully")
	return mc, nil
}

func (mc *MinIOClient) ensureBuckets() error {
	buckets := []string{mc.inputBucket, mc.outputBucket, mc.segmentsBucket}
	ctx := context.Background()

	for _, bucket := range buckets {
		exists, err := mc.client.BucketExists(ctx, bucket)
		if err != nil {
			return fmt.Errorf("failed to check bucket %s: %w", bucket, err)
		}
		if !exists {
			err = mc.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
			if err != nil {
				return fmt.Errorf("failed to create bucket %s: %w", bucket, err)
			}
			log.Printf("Bucket %s created", bucket)
		}
	}
	return nil
}

func (mc *MinIOClient) UploadInput(ctx context.Context, objectName string, reader io.Reader, size int64, contentType string) error {
	_, err := mc.client.PutObject(ctx, mc.inputBucket, objectName, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

func (mc *MinIOClient) UploadSegment(ctx context.Context, objectName string, reader io.Reader, size int64) error {
	_, err := mc.client.PutObject(ctx, mc.segmentsBucket, objectName, reader, size, minio.PutObjectOptions{
		ContentType: "video/mp4",
	})
	return err
}

func (mc *MinIOClient) UploadOutput(ctx context.Context, objectName string, reader io.Reader, size int64) error {
	_, err := mc.client.PutObject(ctx, mc.outputBucket, objectName, reader, size, minio.PutObjectOptions{
		ContentType: "video/mp4",
	})
	return err
}

func (mc *MinIOClient) GetInput(ctx context.Context, objectName string) (*minio.Object, error) {
	return mc.client.GetObject(ctx, mc.inputBucket, objectName, minio.GetObjectOptions{})
}

func (mc *MinIOClient) GetSegment(ctx context.Context, objectName string) (*minio.Object, error) {
	return mc.client.GetObject(ctx, mc.segmentsBucket, objectName, minio.GetObjectOptions{})
}

func (mc *MinIOClient) GetOutput(ctx context.Context, objectName string) (*minio.Object, error) {
	return mc.client.GetObject(ctx, mc.outputBucket, objectName, minio.GetObjectOptions{})
}

func (mc *MinIOClient) GetPresignedURL(ctx context.Context, bucket, objectName string, expires time.Duration) (string, error) {
	url, err := mc.client.PresignedGetObject(ctx, bucket, objectName, expires, nil)
	if err != nil {
		return "", err
	}
	return url.String(), nil
}

func (mc *MinIOClient) GetInputPresignedURL(ctx context.Context, objectName string) (string, error) {
	return mc.GetPresignedURL(ctx, mc.inputBucket, objectName, 24*time.Hour)
}

func (mc *MinIOClient) GetOutputPresignedURL(ctx context.Context, objectName string) (string, error) {
	return mc.GetPresignedURL(ctx, mc.outputBucket, objectName, 24*time.Hour)
}

func (mc *MinIOClient) DeleteInput(ctx context.Context, objectName string) error {
	return mc.client.RemoveObject(ctx, mc.inputBucket, objectName, minio.RemoveObjectOptions{})
}

func (mc *MinIOClient) DeleteSegment(ctx context.Context, objectName string) error {
	return mc.client.RemoveObject(ctx, mc.segmentsBucket, objectName, minio.RemoveObjectOptions{})
}

func (mc *MinIOClient) DeleteOutput(ctx context.Context, objectName string) error {
	return mc.client.RemoveObject(ctx, mc.outputBucket, objectName, minio.RemoveObjectOptions{})
}

func (mc *MinIOClient) GetInputBucket() string {
	return mc.inputBucket
}

func (mc *MinIOClient) GetOutputBucket() string {
	return mc.outputBucket
}

func (mc *MinIOClient) GetSegmentsBucket() string {
	return mc.segmentsBucket
}
