# 🧬 Gene Sequence Alignment System

A high-performance RESTful API for gene sequence alignment using optimized BLAST algorithm with BWT indexing.

## Features

- **BLAST Alignment**: Optimized local sequence alignment supporting both DNA and Protein sequences
- **BWT Indexing**: Fast pattern search using Burrows-Wheeler Transform
- **Parallel Processing**: Celery task queue for parallel alignment of multiple sequences
- **MongoDB Storage**: Scalable sequence database with persistent storage
- **Web Interface**: User-friendly frontend for uploading sequences and viewing results

## Tech Stack

- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Task Queue**: Celery + Redis
- **Frontend**: HTML + CSS + JavaScript

## Project Structure

```
p131/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── core/
│   │   ├── config.py            # Configuration settings
│   │   └── database.py          # MongoDB connection
│   ├── models/
│   │   └── schemas.py           # Pydantic data models
│   ├── algorithms/
│   │   ├── blast.py              # BLAST alignment algorithm
│   │   ├── bwt_index.py          # BWT index implementation
│   │   └── fasta_parser.py     # FASTA file parser
│   ├── services/
│   │   └── sequence_service.py   # Sequence database operations
│   ├── tasks/
│   │   ├── celery_config.py      # Celery configuration
│   │   └── alignment_tasks.py    # Alignment tasks
│   ├── api/
│   │   ├── sequences.py           # Sequence management API
│   │   └── alignment.py          # Alignment API
│   ├── templates/                  # HTML templates
│   └── static/                     # CSS and JavaScript
├── data/
│   └── example_sequences.fasta   # Example sequences
├── requirements.txt
├── start.sh
└── README.md
```

## Installation & Usage

### Prerequisites

- Python 3.8+
- MongoDB
- Redis

### Quick Start

1. **Install dependencies**:
```bash
pip install -r requirements.txt
```

2. **Start MongoDB**:
```bash
mkdir -p data/db
mongod --dbpath ./data/db
```

3. **Start Redis**:
```bash
redis-server
```

4. **Start Celery worker**:
```bash
celery -A app.tasks.celery_config.celery_app worker --loglevel=info
```

5. **Start FastAPI server**:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. **Open the web interface**:
```
http://localhost:8000
```

### API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Sequences

- `GET `/api/sequences/` - List all sequences
- `GET `/api/sequences/{seq_id}` - Get sequence by ID
- `POST `/api/sequences/` - Create new sequence
- `POST `/api/sequences/upload-fasta` - Upload sequences from FASTA file
- `DELETE `/api/sequences/{seq_id}` - Delete sequence
- `GET `/api/sequences/stats` - Get database statistics

### Alignment

- `POST `/api/alignment/submit` - Submit alignment job (async)
- `POST `/api/alignment/submit-fasta` - Submit FASTA file for alignment
- `POST `/api/alignment/sync` - Synchronous alignment
- `GET `/api/alignment/job/{job_id}` - Get alignment job status

## Algorithm Details

### BLAST Algorithm

The system implements a simplified version of BLAST (Basic Local Alignment Search Tool):

1. **Seeding**: Finds exact matches (words) between query and database
2. **Extension**: Extends matches in both directions using scoring matrix
3. **E-value Calculation**: Calculates statistical significance of alignments

### BWT Index

Burrows-Wheeler Transform for fast pattern matching:

- Builds BWT index for each sequence
- Supports fast pattern search
- Memory-efficient indexing

### Scoring

- **DNA**: Simple match/mismatch scoring (1/-1)
- **Protein**: BLOSUM62 matrix for protein alignments

## Web Interface

1. **Home Page**: Overview and database statistics
2. **Upload Page**: Upload sequences to database or submit alignment jobs
3. **Results Page**: View alignment results and sequence database

## License

MIT License
