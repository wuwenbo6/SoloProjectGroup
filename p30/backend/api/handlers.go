package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"

	"backend/database"
	"backend/models"
	"github.com/gorilla/mux"
)

type SSEBroker struct {
	clients     map[chan string]bool
	newClients  chan chan string
	defunctClients chan chan string
	messages    chan string
}

var (
	broker *SSEBroker
	once   sync.Once
)

func GetSSEBroker() *SSEBroker {
	once.Do(func() {
		broker = &SSEBroker{
			clients:        make(map[chan string]bool),
			newClients:     make(chan chan string),
			defunctClients: make(chan chan string),
			messages:       make(chan string, 100),
		}
		go broker.Start()
	})
	return broker
}

func (b *SSEBroker) Start() {
	for {
		select {
		case s := <-b.newClients:
			b.clients[s] = true
		case s := <-b.defunctClients:
			delete(b.clients, s)
			close(s)
		case msg := <-b.messages:
			for s := range b.clients {
				select {
				case s <- msg:
				default:
					b.defunctClients <- s
				}
			}
		}
	}
}

func (b *SSEBroker) BroadcastMessage(msg string) {
	b.messages <- msg
}

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) HandleBatchData(w http.ResponseWriter, r *http.Request) {
	var req models.BatchDataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx := database.DB.Begin()
	if tx.Error != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	syncedCount := 0
	for i := range req.Data {
		var existing models.CollectedData
		if err := tx.Where("data_id = ?", req.Data[i].ID).First(&existing).Error; err == nil {
			syncedCount++
			continue
		}

		req.Data[i].EdgeID = req.EdgeID
		req.Data[i].CreatedAt = time.Now()
		if err := tx.Create(&req.Data[i]).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to save data", http.StatusInternalServerError)
			return
		}
		syncedCount++
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"count":     syncedCount,
		"timestamp": time.Now(),
	})
}

func (h *Handler) HandleBatchResults(w http.ResponseWriter, r *http.Request) {
	var req models.BatchResultsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx := database.DB.Begin()
	if tx.Error != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}

	syncedCount := 0
	for i := range req.Results {
		var existing models.InferenceResult
		if err := tx.Where("result_id = ?", req.Results[i].ID).First(&existing).Error; err == nil {
			syncedCount++
			continue
		}

		req.Results[i].EdgeID = req.EdgeID
		req.Results[i].CreatedAt = time.Now()
		if err := tx.Create(&req.Results[i]).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to save results", http.StatusInternalServerError)
			return
		}
		syncedCount++
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	if syncedCount > 0 {
		msg, _ := json.Marshal(map[string]interface{}{
			"type":  "new_results",
			"count": syncedCount,
			"timestamp": time.Now(),
		})
		GetSSEBroker().BroadcastMessage(string(msg))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"count":     syncedCount,
		"timestamp": time.Now(),
	})
}

func (h *Handler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	messageChan := make(chan string)
	GetSSEBroker().newClients <- messageChan

	notify := r.Context().Done()
	go func() {
		<-notify
		GetSSEBroker().defunctClients <- messageChan
	}()

	w.Write([]byte(": ping\n\n"))
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-messageChan:
			if !ok {
				return
			}
			w.Write([]byte("data: " + msg + "\n\n"))
			flusher.Flush()
		case <-ticker.C:
			w.Write([]byte(": keepalive\n\n"))
			flusher.Flush()
		}
	}
}

func (h *Handler) HandleGetDeltaResults(w http.ResponseWriter, r *http.Request) {
	since := r.URL.Query().Get("since")
	var results []models.InferenceResult
	
	query := database.DB.Order("timestamp DESC").Limit(20)
	if since != "" {
		query = query.Where("timestamp > ?", since)
	}
	
	if err := query.Find(&results).Error; err != nil {
		http.Error(w, "Failed to fetch delta results", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"results":   results,
		"timestamp": time.Now(),
	})
}

func (h *Handler) HandleGetLatestModel(w http.ResponseWriter, r *http.Request) {
	modelType := r.URL.Query().Get("model_type")
	if modelType == "" {
		modelType = "image_classification"
	}

	var model models.ModelVersion
	if err := database.DB.Where("model_type = ?", modelType).
		Order("created_at DESC").
		First(&model).Error; err != nil {
		http.Error(w, "Model not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(model)
}

func (h *Handler) HandleAlert(w http.ResponseWriter, r *http.Request) {
	var alert models.Alert
	if err := json.NewDecoder(r.Body).Decode(&alert); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	alert.CreatedAt = time.Now()
	if err := database.DB.Create(&alert).Error; err != nil {
		http.Error(w, "Failed to create alert", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(alert)
}

func (h *Handler) HandleGetAlerts(w http.ResponseWriter, r *http.Request) {
	resolved := r.URL.Query().Get("resolved")
	limit := 100
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		limit = l
	}

	var alerts []models.Alert
	query := database.DB.Order("timestamp DESC").Limit(limit)
	if resolved != "" {
		query = query.Where("resolved = ?", resolved == "true")
	}

	if err := query.Find(&alerts).Error; err != nil {
		http.Error(w, "Failed to fetch alerts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

func (h *Handler) HandleGetStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := database.GetStatistics()
	if err != nil {
		http.Error(w, "Failed to get statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *Handler) HandleGetPestKnowledge(w http.ResponseWriter, r *http.Request) {
	var pests []models.PestKnowledge
	if err := database.DB.Find(&pests).Error; err != nil {
		http.Error(w, "Failed to fetch pest knowledge", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pests)
}

func (h *Handler) HandleGetResults(w http.ResponseWriter, r *http.Request) {
	edgeID := r.URL.Query().Get("edge_id")
	pestType := r.URL.Query().Get("pest_type")
	limit := 50
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		limit = l
	}

	var results []models.InferenceResult
	query := database.DB.Order("timestamp DESC").Limit(limit)
	if edgeID != "" {
		query = query.Where("edge_id = ?", edgeID)
	}
	if pestType != "" {
		query = query.Where("pest_type = ?", pestType)
	}

	if err := query.Find(&results).Error; err != nil {
		http.Error(w, "Failed to fetch results", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *Handler) HandleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now(),
		"service":   "pest-monitor-backend",
	})
}

func SetupRoutes(r *mux.Router, h *Handler) {
	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/health", h.HandleHealthCheck).Methods("GET")
	api.HandleFunc("/stream", h.HandleSSE).Methods("GET")
	api.HandleFunc("/data/batch", h.HandleBatchData).Methods("POST")
	api.HandleFunc("/results/batch", h.HandleBatchResults).Methods("POST")
	api.HandleFunc("/results", h.HandleGetResults).Methods("GET")
	api.HandleFunc("/results/delta", h.HandleGetDeltaResults).Methods("GET")
	api.HandleFunc("/models/latest", h.HandleGetLatestModel).Methods("GET")
	api.HandleFunc("/alerts", h.HandleAlert).Methods("POST")
	api.HandleFunc("/alerts", h.HandleGetAlerts).Methods("GET")
	api.HandleFunc("/statistics", h.HandleGetStatistics).Methods("GET")
	api.HandleFunc("/pest-knowledge", h.HandleGetPestKnowledge).Methods("GET")
}
