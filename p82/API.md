# Ceramic API Documentation

## Base URL
```
http://localhost:8080/api/v1
```

## Authentication

### 1. JWT Authentication
For user-based endpoints, include the JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

### 2. API Key Authentication
For system-to-system integration, use the API key:
```
X-API-Key: <your-api-key>
```

---

## API Endpoints

### 1. Authentication Endpoints (`/auth`)

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "email": "admin@example.com",
  "role": "admin"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

#### Create API Key (Admin only)
```http
POST /auth/api-key
Authorization: Bearer <token>
Content-Type: application/json

{
  "system_name": "iot-sensor-system",
  "permissions": "firing:write,kiln:write",
  "expires_days": 365
}
```

---

### 2. Firing Parameters Endpoints (`/firing`) [API Key Auth]

#### Collect Single Parameter
```http
POST /firing/params
X-API-Key: <api-key>
Content-Type: application/json

{
  "batch_id": "BATCH-001",
  "kiln_id": "KILN-01",
  "param_type": "temperature",
  "param_value": 1200.5,
  "param_unit": "celsius"
}
```

#### Batch Collect Parameters
```http
POST /firing/params/batch
X-API-Key: <api-key>
Content-Type: application/json

[
  {
    "batch_id": "BATCH-001",
    "kiln_id": "KILN-01",
    "param_type": "temperature",
    "param_value": 1200.5,
    "param_unit": "celsius"
  },
  {
    "batch_id": "BATCH-001",
    "kiln_id": "KILN-01",
    "param_type": "pressure",
    "param_value": 1.2,
    "param_unit": "bar"
  }
]
```

#### Get Parameters
```http
GET /firing/params?batch_id=BATCH-001&param_type=temperature&start_date=2024-01-01&end_date=2024-12-31
X-API-Key: <api-key>
```

#### Get Parameter Statistics
```http
GET /firing/stats?batch_id=BATCH-001
X-API-Key: <api-key>
```

---

### 3. Kiln Temperature Endpoints (`/kiln`) [API Key Auth]

#### Collect Temperature
```http
POST /kiln/temp
X-API-Key: <api-key>
Content-Type: application/json

{
  "batch_id": "BATCH-001",
  "kiln_id": "KILN-01",
  "temperature": 1250.5,
  "zone": "zone-a"
}
```

#### Batch Collect Temperatures
```http
POST /kiln/temp/batch
X-API-Key: <api-key>
Content-Type: application/json

[
  {
    "batch_id": "BATCH-001",
    "kiln_id": "KILN-01",
    "temperature": 1250.5,
    "zone": "zone-a"
  }
]
```

#### Sync Temperature Data
```http
POST /kiln/temp/sync
X-API-Key: <api-key>
```

#### Get Temperature Records
```http
GET /kiln/temp?batch_id=BATCH-001&zone=zone-a&sync_status=0
X-API-Key: <api-key>
```

#### Get Temperature Statistics
```http
GET /kiln/temp/stats?batch_id=BATCH-001
X-API-Key: <api-key>
```

#### Get Unsynced Count
```http
GET /kiln/temp/unsynced
X-API-Key: <api-key>
```

---

### 4. Process Analysis Endpoints (`/process`) [JWT Auth]

#### Collect Process Parameter
```http
POST /process/params
Authorization: Bearer <token>
Content-Type: application/json

{
  "batch_id": "BATCH-001",
  "process_stage": "firing",
  "param_name": "heating_rate",
  "param_value": 5.5,
  "standard_min": 4.0,
  "standard_max": 6.0
}
```

#### Get Process Parameters
```http
GET /process/params?batch_id=BATCH-001&stage=firing&is_qualified=true
Authorization: Bearer <token>
```

#### Run Process Analysis
```http
GET /process/analysis?batch_id=BATCH-001
Authorization: Bearer <token>
```

#### Get Analysis History
```http
GET /process/analysis/history?batch_id=BATCH-001
Authorization: Bearer <token>
```

---

### 5. Batch Management Endpoints (`/batches`) [JWT Auth]

#### Create Batch
```http
POST /batches
Authorization: Bearer <token>
Content-Type: application/json

{
  "batch_id": "BATCH-001",
  "product_name": "Ceramic Vase",
  "product_type": "decorative",
  "quantity": 100
}
```

#### Get Batches
```http
GET /batches?status=completed&product_type=decorative
Authorization: Bearer <token>
```

#### Get Batch Statistics
```http
GET /batches/stats
Authorization: Bearer <token>
```

#### Get Batch by ID
```http
GET /batches/BATCH-001
Authorization: Bearer <token>
```

#### Update Batch Status
```http
PUT /batches/BATCH-001/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress"
}
```

#### Update Quality Result
```http
PUT /batches/BATCH-001/quality
Authorization: Bearer <token>
Content-Type: application/json

{
  "quality_result": "passed"
}
```

#### Delete Batch
```http
DELETE /batches/BATCH-001
Authorization: Bearer <token>
```

---

### 6. Third Party Integration Endpoints (`/third-party`)

#### Submit Batch to Third Party
```http
POST /third-party/submit/BATCH-001
Content-Type: application/json
```

#### Receive Test Report from Third Party
```http
POST /third-party/report
Content-Type: application/json

{
  "batch_id": "BATCH-001",
  "testing_org": "Quality Lab Inc.",
  "report_id": "REP-2024-001",
  "test_items": {
    "density": "standard",
    "hardness": "standard"
  },
  "test_results": {
    "density": 2.4,
    "hardness": 8.5
  },
  "is_qualified": true
}
```

#### Get Test Reports
```http
GET /third-party/reports?batch_id=BATCH-001&is_qualified=true
```

#### Sync Third Party Data
```http
POST /third-party/sync
```

#### Get Third Party Service Status
```http
GET /third-party/status
```

---

## Database Architecture

### Database Sharding Strategy

| Database | Purpose | Tables |
|----------|---------|--------|
| `ceramic_firing` | Firing parameters and batch management | `firing_params`, `batches`, `third_party_reports` |
| `ceramic_kiln_temp` | Kiln temperature data | `kiln_temp_records` |
| `ceramic_process` | Process parameters and analysis | `process_params`, `process_analyses` |
| `ceramic_auth` | Authentication and authorization | `users`, `api_keys`, `permissions` |

---

## Running with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f ceramic-api

# Stop services
docker-compose down
```

---

## Running Locally

```bash
# Install dependencies
go mod download

# Copy and configure environment
cp .env.example .env

# Run the application
go run main.go
```
