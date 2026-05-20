package storage

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/syndtr/goleveldb/leveldb"
)

type FileMetadata struct {
	FileID            string   `json:"file_id"`
	FileName          string   `json:"file_name"`
	FileSize          int64    `json:"file_size"`
	ChunkCount        int      `json:"chunk_count"`
	ChunkHashes       []string `json:"chunk_hashes"`
	Publisher         string   `json:"publisher"`
	Encrypted         bool     `json:"encrypted"`
	EncryptedAESKey   string   `json:"encrypted_aes_key"`
	PublisherPublicKey string   `json:"publisher_public_key"`
}

type Store struct {
	db *leveldb.DB
}

func NewStore(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, err
	}

	db, err := leveldb.OpenFile(path, nil)
	if err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) PutFile(meta *FileMetadata) error {
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	key := []byte("file:" + meta.FileID)
	return s.db.Put(key, data, nil)
}

func (s *Store) GetFile(fileID string) (*FileMetadata, error) {
	key := []byte("file:" + fileID)
	data, err := s.db.Get(key, nil)
	if err != nil {
		return nil, err
	}

	var meta FileMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}

	return &meta, nil
}

func (s *Store) DeleteFile(fileID string) error {
	key := []byte("file:" + fileID)
	return s.db.Delete(key, nil)
}

func (s *Store) ListFiles() ([]*FileMetadata, error) {
	var files []*FileMetadata

	iter := s.db.NewIterator(nil, nil)
	defer iter.Release()

	prefix := []byte("file:")
	for iter.Next() {
		key := iter.Key()
		if len(key) < len(prefix) || string(key[:len(prefix)]) != "file:" {
			continue
		}

		var meta FileMetadata
		if err := json.Unmarshal(iter.Value(), &meta); err != nil {
			continue
		}

		files = append(files, &meta)
	}

	return files, iter.Error()
}

func (s *Store) PutProvider(fileID string, nodeAddr string) error {
	key := []byte("provider:" + fileID + ":" + nodeAddr)
	return s.db.Put(key, []byte(nodeAddr), nil)
}

func (s *Store) GetProviders(fileID string) ([]string, error) {
	var providers []string

	iter := s.db.NewIterator(nil, nil)
	defer iter.Release()

	prefix := []byte("provider:" + fileID + ":")
	for iter.Next() {
		key := iter.Key()
		if len(key) < len(prefix) {
			continue
		}
		if string(key[:len(prefix)]) == string(prefix) {
			providers = append(providers, string(iter.Value()))
		}
	}

	return providers, iter.Error()
}

func (s *Store) Close() error {
	return s.db.Close()
}
