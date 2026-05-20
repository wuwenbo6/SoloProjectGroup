package device

import (
	context "context"
	grpc "google.golang.org/grpc"
)

type DeviceDataServiceClient interface {
	ReportDeviceData(ctx context.Context, in *BatchDeviceDataRequest, opts ...grpc.CallOption) (*BatchDeviceDataResponse, error)
}

type DeviceDataServiceServer interface {
	ReportDeviceData(context.Context, *BatchDeviceDataRequest) (*BatchDeviceDataResponse, error)
	mustEmbedUnimplementedDeviceDataServiceServer()
}

type UnimplementedDeviceDataServiceServer struct {
}

func (UnimplementedDeviceDataServiceServer) ReportDeviceData(context.Context, *BatchDeviceDataRequest) (*BatchDeviceDataResponse, error) {
	return nil, grpc.Errorf(grpc.Code(grpc.Unimplemented), "method not implemented")
}

func (UnimplementedDeviceDataServiceServer) mustEmbedUnimplementedDeviceDataServiceServer() {}
