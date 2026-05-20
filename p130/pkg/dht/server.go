package dht

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/kademlia-dht/pkg/crypto"
	"github.com/kademlia-dht/pkg/kademlia"
	"github.com/kademlia-dht/pkg/nat"
	"github.com/kademlia-dht/pkg/reputation"
	"github.com/kademlia-dht/pkg/storage"
	pb "github.com/kademlia-dht/proto"
)

const (
	ChunkSize       = 1024 * 1024
	MaxRetries      = 3
	RetryDelay      = 500 * time.Millisecond
	MaxLookupSteps  = 20
)

type DHTServer struct {
	pb.UnimplementedDHTServiceServer
	node        *kademlia.Node
	store       *storage.Store
	grpcServer  *grpc.Server
	upnp        *nat.UPnP
	dataDir     string
	keyPair     *crypto.KeyPair
	reputation  *reputation.ReputationStore
	mu          sync.RWMutex
}

func NewDHTServer(address, dataDir string) (*DHTServer, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dataDir, "leveldb")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		return nil, err
	}

	node := kademlia.NewNode(address)

	keyPath := filepath.Join(dataDir, "keys")
	os.MkdirAll(keyPath, 0700)

	var keyPair *crypto.KeyPair
	privKeyPath := filepath.Join(keyPath, "private.pem")
	pubKeyPath := filepath.Join(keyPath, "public.pem")

	if _, err := os.Stat(privKeyPath); os.IsNotExist(err) {
		keyPair, err = crypto.GenerateKeyPair()
		if err != nil {
			return nil, err
		}
		keyPair.SavePrivateKey(privKeyPath)
		keyPair.SavePublicKey(pubKeyPath)
	} else {
		privKey, err := crypto.LoadPrivateKey(privKeyPath)
		if err != nil {
			return nil, err
		}
		pubKey, err := crypto.LoadPublicKey(pubKeyPath)
		if err != nil {
			return nil, err
		}
		keyPair = &crypto.KeyPair{
			PrivateKey: privKey,
			PublicKey:  pubKey,
		}
	}

	repStore := reputation.NewReputationStore(dataDir)

	return &DHTServer{
		node:       node,
		store:      store,
		dataDir:    dataDir,
		keyPair:    keyPair,
		reputation: repStore,
	}, nil
}

func (s *DHTServer) EnableUPnP(port int) error {
	upnp, err := nat.NewUPnP()
	if err != nil {
		return err
	}

	extIP, _, err := upnp.SetupPortForwarding(port)
	if err != nil {
		return err
	}

	s.upnp = upnp
	log.Printf("UPnP enabled, external IP: %s", extIP)
	return nil
}

func (s *DHTServer) Start() error {
	lis, err := net.Listen("tcp", s.node.Address)
	if err != nil {
		return err
	}

	s.grpcServer = grpc.NewServer()
	pb.RegisterDHTServiceServer(s.grpcServer, s)

	log.Printf("DHT Server listening on %s, ID: %s", s.node.Address, s.node.ID.String())
	return s.grpcServer.Serve(lis)
}

func (s *DHTServer) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.Stop()
	}
	s.store.Close()
}

func (s *DHTServer) Bootstrap(bootstrapAddr string) error {
	conn, err := grpc.Dial(bootstrapAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return err
	}
	defer conn.Close()

	client := pb.NewDHTServiceClient(conn)

	resp, err := client.Ping(context.Background(), &pb.PingRequest{
		NodeId:  s.node.ID.String(),
		Address: s.node.Address,
	})
	if err != nil {
		return err
	}

	s.node.RoutingTable.AddContact(&kademlia.Contact{
		ID:      parseNodeID(resp.NodeId),
		Address: bootstrapAddr,
	})

	log.Printf("Bootstrapped with %s", bootstrapAddr)
	return nil
}

func (s *DHTServer) Ping(ctx context.Context, req *pb.PingRequest) (*pb.PingResponse, error) {
	s.node.RoutingTable.AddContact(&kademlia.Contact{
		ID:      parseNodeID(req.NodeId),
		Address: req.Address,
	})

	return &pb.PingResponse{
		NodeId: s.node.ID.String(),
	}, nil
}

func (s *DHTServer) FindNode(ctx context.Context, req *pb.FindNodeRequest) (*pb.FindNodeResponse, error) {
	targetID := parseNodeID(req.TargetId)
	contacts := s.node.RoutingTable.FindClosest(targetID, 20)

	var addresses []string
	for _, c := range contacts {
		if c.Address != s.node.Address {
			addresses = append(addresses, c.Address)
		}
	}

	return &pb.FindNodeResponse{
		Contacts: addresses,
	}, nil
}

func (s *DHTServer) FindValue(ctx context.Context, req *pb.FindValueRequest) (*pb.FindValueResponse, error) {
	meta, err := s.store.GetFile(req.FileId)
	if err == nil {
		providers, _ := s.store.GetProviders(req.FileId)
		var filteredProviders []string
		for _, p := range providers {
			if p != s.node.Address {
				filteredProviders = append(filteredProviders, p)
			}
		}
		return &pb.FindValueResponse{
			Metadata: &pb.FileMetadata{
				FileId:      meta.FileID,
				FileName:    meta.FileName,
				FileSize:    meta.FileSize,
				ChunkCount:  int32(meta.ChunkCount),
				ChunkHashes: meta.ChunkHashes,
				Publisher:   meta.Publisher,
			},
			Providers: filteredProviders,
		}, nil
	}

	targetID := parseNodeID(req.FileId)
	contacts := s.node.RoutingTable.FindClosest(targetID, 20)

	var addresses []string
	for _, c := range contacts {
		if c.Address != s.node.Address {
			addresses = append(addresses, c.Address)
		}
	}

	return &pb.FindValueResponse{
		Contacts: addresses,
	}, nil
}

func (s *DHTServer) PublishFile(ctx context.Context, req *pb.PublishFileRequest) (*pb.PublishFileResponse, error) {
	meta := req.Metadata

	chunkPath := filepath.Join(s.dataDir, "chunks", meta.FileId)
	os.MkdirAll(chunkPath, 0755)

	chunkFile := filepath.Join(chunkPath, fmt.Sprintf("chunk_%d", req.ChunkIndex))
	if err := os.WriteFile(chunkFile, req.ChunkData, 0644); err != nil {
		return &pb.PublishFileResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	if req.ChunkIndex == 0 {
		fileMeta := &storage.FileMetadata{
			FileID:      meta.FileId,
			FileName:    meta.FileName,
			FileSize:    meta.FileSize,
			ChunkCount:  int(meta.ChunkCount),
			ChunkHashes: meta.ChunkHashes,
			Publisher:   meta.Publisher,
		}

		if err := s.store.PutFile(fileMeta); err != nil {
			return &pb.PublishFileResponse{
				Success: false,
				Message: err.Error(),
			}, nil
		}
	}

	s.store.PutProvider(meta.FileId, s.node.Address)

	return &pb.PublishFileResponse{
		Success: true,
		Message: "Chunk published",
	}, nil
}

func (s *DHTServer) GetChunk(ctx context.Context, req *pb.GetChunkRequest) (*pb.GetChunkResponse, error) {
	chunkFile := filepath.Join(s.dataDir, "chunks", req.FileId, fmt.Sprintf("chunk_%d", req.ChunkIndex))

	data, err := os.ReadFile(chunkFile)
	if err != nil {
		return &pb.GetChunkResponse{
			Success: false,
		}, nil
	}

	s.reputation.RecordUpload(s.node.ID.String(), s.node.Address, int64(len(data)))

	return &pb.GetChunkResponse{
		Data:    data,
		Success: true,
	}, nil
}

func (s *DHTServer) LocalPublishFile(filePath string, encrypted bool) (string, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return "", err
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	fileID := generateFileID(filePath)
	chunkCount := int((fileInfo.Size() + ChunkSize - 1) / ChunkSize)

	chunkDir := filepath.Join(s.dataDir, "chunks", fileID)
	os.MkdirAll(chunkDir, 0755)

	var chunkHashes []string
	var aesKey []byte

	if encrypted {
		aesKey, err = crypto.GenerateAESKey()
		if err != nil {
			return "", err
		}
	}

	for i := 0; i < chunkCount; i++ {
		buf := make([]byte, ChunkSize)
		n, err := file.Read(buf)
		if err != nil && err != io.EOF {
			return "", err
		}

		chunkData := buf[:n]

		if encrypted {
			chunkData, err = crypto.EncryptWithAES(aesKey, chunkData)
			if err != nil {
				return "", err
			}
		}

		hash := sha256.Sum256(chunkData)
		chunkHashes = append(chunkHashes, hex.EncodeToString(hash[:]))

		chunkFile := filepath.Join(chunkDir, fmt.Sprintf("chunk_%d", i))
		if err := os.WriteFile(chunkFile, chunkData, 0644); err != nil {
			return "", err
		}
	}

	pubKeyStr, _ := crypto.PublicKeyToString(s.keyPair.PublicKey)
	var encryptedAESKey string
	if encrypted {
		encryptedKey, err := crypto.EncryptWithPublicKey(s.keyPair.PublicKey, aesKey)
		if err != nil {
			return "", err
		}
		encryptedAESKey = hex.EncodeToString(encryptedKey)
	}

	meta := &storage.FileMetadata{
		FileID:            fileID,
		FileName:          filepath.Base(filePath),
		FileSize:          fileInfo.Size(),
		ChunkCount:        chunkCount,
		ChunkHashes:       chunkHashes,
		Publisher:         s.node.Address,
		Encrypted:         encrypted,
		EncryptedAESKey:   encryptedAESKey,
		PublisherPublicKey: pubKeyStr,
	}

	if err := s.store.PutFile(meta); err != nil {
		return "", err
	}

	s.store.PutProvider(fileID, s.node.Address)

	return fileID, nil
}

func verifyChunk(data []byte, expectedHash string) bool {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]) == expectedHash
}

type downloadResult struct {
	idx  int
	data []byte
	err  error
}

func (s *DHTServer) DownloadFileParallel(fileID, outputPath string, maxWorkers int) error {
	providers, err := s.store.GetProviders(fileID)
	if err != nil || len(providers) == 0 {
		return fmt.Errorf("no providers found")
	}

	sortedProviders := s.reputation.SortByPriority(providers)

	meta, err := s.store.GetFile(fileID)
	if err != nil {
		return fmt.Errorf("file metadata not found")
	}

	chunks := make([][]byte, meta.ChunkCount)
	chunkChan := make(chan int, meta.ChunkCount)
	resultChan := make(chan downloadResult, meta.ChunkCount)

	for i := 0; i < maxWorkers && i < len(sortedProviders); i++ {
		provider := sortedProviders[i]
		go s.worker(provider, fileID, meta.ChunkHashes, chunkChan, resultChan)
	}

	for i := 0; i < meta.ChunkCount; i++ {
		chunkChan <- i
	}
	close(chunkChan)

	successCount := 0
	for successCount < meta.ChunkCount {
		select {
		case result := <-resultChan:
			if result.err != nil {
				chunkChan <- result.idx
			} else {
				chunks[result.idx] = result.data
				successCount++
				log.Printf("Downloaded chunk %d (%d/%d)", result.idx, successCount, meta.ChunkCount)
			}
		}
	}

	var aesKey []byte
	if meta.Encrypted {
		encryptedKey, _ := hex.DecodeString(meta.EncryptedAESKey)
		aesKey, err = crypto.DecryptWithPrivateKey(s.keyPair.PrivateKey, encryptedKey)
		if err != nil {
			return fmt.Errorf("failed to decrypt AES key: %v", err)
		}
	}

	outFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	for _, chunk := range chunks {
		if meta.Encrypted {
			chunk, err = crypto.DecryptWithAES(aesKey, chunk)
			if err != nil {
				return fmt.Errorf("failed to decrypt chunk: %v", err)
			}
		}
		if _, err := outFile.Write(chunk); err != nil {
			return err
		}
	}

	log.Printf("Successfully downloaded %d chunks (parallel)", successCount)
	return nil
}

func (s *DHTServer) worker(provider, fileID string, chunkHashes []string, chunkChan <-chan int, resultChan chan<- downloadResult) {
	conn, err := grpc.Dial(provider, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return
	}
	defer conn.Close()

	client := pb.NewDHTServiceClient(conn)

	for chunkIdx := range chunkChan {
		success := false
		for retry := 0; retry < MaxRetries; retry++ {
			resp, err := client.GetChunk(context.Background(), &pb.GetChunkRequest{
				FileId:     fileID,
				ChunkIndex: int32(chunkIdx),
			})

			if err != nil || !resp.Success {
				time.Sleep(RetryDelay)
				continue
			}

			if verifyChunk(resp.Data, chunkHashes[chunkIdx]) {
				resultChan <- downloadResult{idx: chunkIdx, data: resp.Data, err: nil}
				success = true
				break
			}

			time.Sleep(RetryDelay)
		}

		if !success {
			resultChan <- downloadResult{idx: chunkIdx, data: nil, err: fmt.Errorf("failed after retries")}
		}
	}
}

func (s *DHTServer) DownloadFile(fileID, outputPath string) error {
	return s.DownloadFileParallel(fileID, outputPath, 4)
}

func (s *DHTServer) GetNodeID() string {
	return s.node.ID.String()
}

func (s *DHTServer) GetAddress() string {
	return s.node.Address
}

func (s *DHTServer) FindFileIterative(fileID string) (*pb.FileMetadata, []string, error) {
	visited := make(map[string]bool)
	queue := make([]string, 0)

	initialContacts := s.node.RoutingTable.FindClosest(parseNodeID(fileID), 5)
	for _, c := range initialContacts {
		if c.Address != s.node.Address {
			queue = append(queue, c.Address)
		}
	}

	for step := 0; step < MaxLookupSteps && len(queue) > 0; step++ {
		current := queue[0]
		queue = queue[1:]

		if visited[current] {
			continue
		}
		visited[current] = true

		conn, err := grpc.Dial(current, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			continue
		}

		client := pb.NewDHTServiceClient(conn)
		resp, err := client.FindValue(context.Background(), &pb.FindValueRequest{
			FileId: fileID,
		})
		conn.Close()

		if err != nil {
			continue
		}

		if resp.Metadata != nil {
			return resp.Metadata, resp.Providers, nil
		}

		for _, contact := range resp.Contacts {
			if !visited[contact] && contact != s.node.Address {
				queue = append(queue, contact)
			}
		}
	}

	localMeta, err := s.store.GetFile(fileID)
	if err == nil {
		providers, _ := s.store.GetProviders(fileID)
		return &pb.FileMetadata{
			FileId:      localMeta.FileID,
			FileName:    localMeta.FileName,
			FileSize:    localMeta.FileSize,
			ChunkCount:  int32(localMeta.ChunkCount),
			ChunkHashes: localMeta.ChunkHashes,
			Publisher:   localMeta.Publisher,
		}, providers, nil
	}

	return nil, nil, fmt.Errorf("file not found after %d steps", MaxLookupSteps)
}

func parseNodeID(idStr string) kademlia.NodeID {
	var id kademlia.NodeID
	data, _ := hex.DecodeString(idStr)
	copy(id[:], data)
	return id
}

func generateFileID(filePath string) string {
	fileInfo, _ := os.Stat(filePath)
	data := []byte(filePath + fileInfo.ModTime().String())
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}
