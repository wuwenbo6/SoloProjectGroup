package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/kademlia-dht/pkg/dht"
	pb "github.com/kademlia-dht/proto"
)

const (
	MaxRetries     = 3
	RetryDelay     = 500 * time.Millisecond
	MaxLookupSteps = 20
)

var rootCmd = &cobra.Command{
	Use:   "dht-cli",
	Short: "Kademlia DHT CLI",
}

var (
	serverAddr  string
	dataDir   string
	bootstrap  string
	encrypted  bool
	workers    int
)

func init() {
	rootCmd.PersistentFlags().StringVar(&serverAddr, "server", "localhost:8000", "DHT server address")

	startCmd := &cobra.Command{
		Use:   "start",
		Short: "Start DHT node",
		Run:   runStart,
	}
	startCmd.Flags().StringVar(&dataDir, "data", "./data", "Data directory")
	startCmd.Flags().StringVar(&bootstrap, "bootstrap", "", "Bootstrap node address")
	rootCmd.AddCommand(startCmd)

	publishCmd := &cobra.Command{
		Use:   "publish [file]",
		Short: "Publish a file",
		Args:  cobra.ExactArgs(1),
		Run:   runPublish,
	}
	publishCmd.Flags().BoolVarP(&encrypted, "encrypt", "e", false, "Encrypt the file")
	rootCmd.AddCommand(publishCmd)

	downloadCmd := &cobra.Command{
		Use:   "download [file-id] [output]",
		Short: "Download a file",
		Args:  cobra.ExactArgs(2),
		Run:   runDownload,
	}
	downloadCmd.Flags().IntVarP(&workers, "workers", "w", 4, "Number of parallel download workers")
	rootCmd.AddCommand(downloadCmd)

	findCmd := &cobra.Command{
		Use:   "find [file-id]",
		Short: "Find a file in DHT",
		Args:  cobra.ExactArgs(1),
		Run:   runFind,
	}
	rootCmd.AddCommand(findCmd)

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List local files",
		Run:   runList,
	}
	rootCmd.AddCommand(listCmd)

	reputationCmd := &cobra.Command{
		Use:   "reputation",
		Short: "Show node reputation statistics",
		Run:   runReputation,
	}
	rootCmd.AddCommand(reputationCmd)
}

func runStart(cmd *cobra.Command, args []string) {
	server, err := dht.NewDHTServer(serverAddr, dataDir)
	if err != nil {
		fmt.Printf("Failed to create server: %v\n", err)
		os.Exit(1)
	}

	if bootstrap != "" {
		if err := server.Bootstrap(bootstrap); err != nil {
			fmt.Printf("Failed to bootstrap: %v\n", err)
		}
	}

	fmt.Printf("Node ID: %s\n", server.GetNodeID())
	fmt.Printf("Listening on: %s\n", server.GetAddress())

	// Handle local publish in a separate goroutine if needed
	// For now, just start the server
	if err := server.Start(); err != nil {
		fmt.Printf("Server error: %v\n", err)
		os.Exit(1)
	}
}

func runPublish(cmd *cobra.Command, args []string) {
	filePath := args[0]

	absPath, err := filepath.Abs(filePath)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		fmt.Printf("Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()

	client := pb.NewDHTServiceClient(conn)

	fileInfo, err := os.Stat(absPath)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	file, err := os.Open(absPath)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	fileID := generateFileID(absPath)
	chunkSize := 1024 * 1024
	chunkCount := int((fileInfo.Size() + int64(chunkSize) - 1) / int64(chunkSize))

	var chunkHashes []string
	for i := 0; i < chunkCount; i++ {
		buf := make([]byte, chunkSize)
		n, _ := file.Read(buf)
		hash := sha256.Sum256(buf[:n])
		chunkHashes = append(chunkHashes, hex.EncodeToString(hash[:]))
	}

	file.Seek(0, 0)

	for i := 0; i < chunkCount; i++ {
		buf := make([]byte, chunkSize)
		n, _ := file.Read(buf)

		_, err := client.PublishFile(context.Background(), &pb.PublishFileRequest{
			Metadata: &pb.FileMetadata{
				FileId:      fileID,
				FileName:    filepath.Base(absPath),
				FileSize:   fileInfo.Size(),
				ChunkCount: int32(chunkCount),
				ChunkHashes: chunkHashes,
				Publisher:  serverAddr,
			},
			ChunkData:  buf[:n],
			ChunkIndex: int32(i),
		})

		if err != nil {
			fmt.Printf("Failed to publish chunk %d: %v\n", i, err)
			os.Exit(1)
		}

		fmt.Printf("Published chunk %d/%d\n", i+1, chunkCount)
	}

	fmt.Printf("File published successfully! File ID: %s\n", fileID)
}

func verifyChunk(data []byte, expectedHash string) bool {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]) == expectedHash
}

func findFileIterative(startAddr, fileID string) (*pb.FileMetadata, []string, error) {
	visited := make(map[string]bool)
	queue := []string{startAddr}

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
			if !visited[contact] {
				queue = append(queue, contact)
			}
		}
	}

	return nil, nil, fmt.Errorf("file not found after %d steps", MaxLookupSteps)
}

type cliDownloadResult struct {
	idx  int
	data []byte
	err  error
}

func runDownload(cmd *cobra.Command, args []string) {
	fileID := args[0]
	outputPath := args[1]

	meta, providers, err := findFileIterative(serverAddr, fileID)
	if err != nil {
		fmt.Printf("Failed to find file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found file: %s (%d bytes)\n", meta.FileName, meta.FileSize)
	fmt.Printf("Providers: %v\n", providers)
	fmt.Printf("Downloading with %d parallel workers...\n", workers)

	chunks := make([][]byte, meta.ChunkCount)
	chunkChan := make(chan int, meta.ChunkCount)
	resultChan := make(chan cliDownloadResult, meta.ChunkCount)

	for i := 0; i < workers && i < len(providers); i++ {
		provider := providers[i]
		go downloadWorker(provider, fileID, meta.ChunkHashes, chunkChan, resultChan)
	}

	for i := 0; i < int(meta.ChunkCount); i++ {
		chunkChan <- i
	}
	close(chunkChan)

	successCount := 0
	for successCount < int(meta.ChunkCount) {
		select {
		case result := <-resultChan:
			if result.err != nil {
				chunkChan <- result.idx
			} else {
				chunks[result.idx] = result.data
				successCount++
				fmt.Printf("Downloaded chunk %d (%d/%d)\n", result.idx, successCount, meta.ChunkCount)
			}
		}
	}

	outFile, err := os.Create(outputPath)
	if err != nil {
		fmt.Printf("Failed to create output file: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	for _, chunk := range chunks {
		if _, err := outFile.Write(chunk); err != nil {
			fmt.Printf("Failed to write file: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Printf("File downloaded successfully to: %s\n", outputPath)
}

func downloadWorker(provider, fileID string, chunkHashes []string, chunkChan <-chan int, resultChan chan<- cliDownloadResult) {
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
				resultChan <- cliDownloadResult{idx: chunkIdx, data: resp.Data, err: nil}
				success = true
				break
			}

			time.Sleep(RetryDelay)
		}

		if !success {
			resultChan <- cliDownloadResult{idx: chunkIdx, data: nil, err: fmt.Errorf("failed after retries")}
		}
	}
}

func runFind(cmd *cobra.Command, args []string) {
	fileID := args[0]

	meta, providers, err := findFileIterative(serverAddr, fileID)
	if err != nil {
		fmt.Printf("Failed to find file: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("File found!")
	fmt.Printf("  Name: %s\n", meta.FileName)
	fmt.Printf("  Size: %d bytes\n", meta.FileSize)
	fmt.Printf("  Chunks: %d\n", meta.ChunkCount)
	fmt.Printf("  Providers: %v\n", providers)
}

func runList(cmd *cobra.Command, args []string) {
	fmt.Println("Local files feature requires direct server API not implemented in CLI")
}

func runReputation(cmd *cobra.Command, args []string) {
	server, err := dht.NewDHTServer(serverAddr, dataDir)
	if err != nil {
		fmt.Printf("Failed to create server: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Reputation statistics are per-node and stored locally in each node's data directory")
	fmt.Println("Node reputation is based on upload history and success rate")
	fmt.Println("Currently running node ID:", server.GetNodeID())
}

func generateFileID(filePath string) string {
	fileInfo, _ := os.Stat(filePath)
	data := []byte(filePath + fileInfo.ModTime().String())
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
