package api

import (
	"context"
	"fmt"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"
	"go.uber.org/zap"

	"iot-core-service/internal/models"
	"iot-core-service/internal/service"
	devicePb "iot-core-service/pb/device"
	"iot-core-service/pkg/config"
)

type GRPCServer struct {
	devicePb.UnimplementedDeviceDataServiceServer
	server      *grpc.Server
	dataService *service.DataService
	logger      *zap.Logger
	port        int
}

var (
	kaep = keepalive.EnforcementPolicy{
		MinTime:             5 * time.Second,
		PermitWithoutStream: true,
	}

	kasp = keepalive.ServerParameters{
		MaxConnectionIdle:     15 * time.Second,
		MaxConnectionAge:      30 * time.Second,
		MaxConnectionAgeGrace: 5 * time.Second,
		Time:                  5 * time.Second,
		Timeout:               1 * time.Second,
	}
)

func NewGRPCServer(cfg *config.Config, dataService *service.DataService, logger *zap.Logger) *GRPCServer {
	s := grpc.NewServer(
		grpc.KeepaliveEnforcementPolicy(kaep),
		grpc.KeepaliveParams(kasp),
		grpc.MaxRecvMsgSize(64*1024*1024),
		grpc.MaxSendMsgSize(64*1024*1024),
		grpc.NumStreamWorkers(10),
	)

	grpcServer := &GRPCServer{
		server:      s,
		dataService: dataService,
		logger:      logger,
		port:        cfg.Server.GRPCPort,
	}

	devicePb.RegisterDeviceDataServiceServer(s, grpcServer)

	return grpcServer
}

func (s *GRPCServer) Start() error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	s.logger.Info("gRPC server starting", zap.Int("port", s.port))

	go func() {
		if err := s.server.Serve(lis); err != nil {
			s.logger.Fatal("gRPC server failed", zap.Error(err))
		}
	}()

	return nil
}

func (s *GRPCServer) Stop() {
	s.server.GracefulStop()
	s.logger.Info("gRPC server stopped")
}

func (s *GRPCServer) ReportDeviceData(ctx context.Context, req *devicePb.BatchDeviceDataRequest) (*devicePb.BatchDeviceDataResponse, error) {
	dataPoints := make([]models.DeviceDataPoint, len(req.DataPoints))
	for i, p := range req.DataPoints {
		dataPoints[i] = models.DeviceDataPoint{
			DeviceID:  p.DeviceId,
			Timestamp: p.Timestamp,
			Metrics:   p.Metrics,
		}
	}

	batchReq := &models.BatchDataRequest{
		DataPoints: dataPoints,
	}

	resp, err := s.dataService.ProcessBatchData(ctx, batchReq)
	if err != nil {
		return nil, err
	}

	errors := make([]string, len(resp.Errors))
	copy(errors, resp.Errors)

	return &devicePb.BatchDeviceDataResponse{
		SuccessCount: int32(resp.SuccessCount),
		FailedCount:  int32(resp.FailedCount),
		Errors:       errors,
	}, nil
}
