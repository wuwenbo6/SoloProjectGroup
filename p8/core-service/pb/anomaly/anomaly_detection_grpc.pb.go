package anomaly

import (
	context "context"
	grpc "google.golang.org/grpc"
)

type AnomalyDetectionServiceClient interface {
	DetectAnomaly(ctx context.Context, in *DetectAnomalyRequest, opts ...grpc.CallOption) (*DetectAnomalyResponse, error)
	BatchDetectAnomaly(ctx context.Context, in *BatchDetectAnomalyRequest, opts ...grpc.CallOption) (*BatchDetectAnomalyResponse, error)
}

type AnomalyDetectionServiceServer interface {
	DetectAnomaly(context.Context, *DetectAnomalyRequest) (*DetectAnomalyResponse, error)
	BatchDetectAnomaly(context.Context, *BatchDetectAnomalyRequest) (*BatchDetectAnomalyResponse, error)
	mustEmbedUnimplementedAnomalyDetectionServiceServer()
}

type UnimplementedAnomalyDetectionServiceServer struct {
}

func (UnimplementedAnomalyDetectionServiceServer) DetectAnomaly(context.Context, *DetectAnomalyRequest) (*DetectAnomalyResponse, error) {
	return nil, grpc.Errorf(grpc.Code(grpc.Unimplemented), "method not implemented")
}

func (UnimplementedAnomalyDetectionServiceServer) BatchDetectAnomaly(context.Context, *BatchDetectAnomalyRequest) (*BatchDetectAnomalyResponse, error) {
	return nil, grpc.Errorf(grpc.Code(grpc.Unimplemented), "method not implemented")
}

func (UnimplementedAnomalyDetectionServiceServer) mustEmbedUnimplementedAnomalyDetectionServiceServer() {}
