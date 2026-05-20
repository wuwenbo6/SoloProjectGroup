# CRISPR Off-Target Predictor

A full-stack bioinformatics tool for predicting CRISPR off-target sites, optimized for large genomes and millions of potential off-target sites.

## Features

### CRISPR Mode Selection
- **CRISPRn (Cas9)**: Gene editing mode - Requires NGG PAM sequence, uses CFD and MIT specificity scores
- **CRISPRa (dCas9)**: Gene activation mode - No PAM required, uses dCas9 binding affinity score

### Functional Risk Prioritization ⭐ NEW ⭐
- **GTF/GFF Annotation Support**: Upload gene annotation files to identify functional impact
- **Feature-based Risk Weighting**:
  - **CDS (Coding Sequence)**: Highest weight (direct protein impact)
  - **5'UTR**: High weight (potential expression regulation)
  - **3'UTR**: Medium weight (potential stability/translation impact)
  - **Exon**: Standard weight
  - **Intron**: Lower weight
  - **Intergenic**: Lowest weight
- **Priority Score Calculation**: Combined score of specificity score × functional risk weight
- **Risk Categories**: CRITICAL / HIGH / MEDIUM / LOW
- **Gene Overlap Detection**: Identify which genes are potentially affected

### IUPAC Degenerate Base Support
- Full support for IUPAC degenerate bases in both gRNA and reference genome
- Supported codes: A, T, G, C, R (A/G), Y (C/T), S (G/C), W (A/T), K (G/T), M (A/C), B (not A), D (not C), H (not G), V (not T), N (any)
- Proper base matching considers degenerate codes on both strands

### Backend (FastAPI + Biopython)
- Upload reference genome (FASTA format)
- Upload gene annotation (GTF/GFF format)
- Accept 20bp gRNA sequence input
- Predict off-target sites using brute-force alignment with up to 4 mismatches
- Optional PAM sequence validation (NGG) for Cas9 mode
- Optional BWA-MEM integration for faster alignment
- **Mode-specific scoring algorithms** (CFD/MIT for Cas9, binding affinity for dCas9)
- **Chunked result storage** with pickle for efficient memory usage
- **Paginated API endpoints** for large result sets
- Export results as BED file

### Frontend (Vue + Mermaid)
- Interactive file upload with drag & drop
- **CRISPR mode selector UI** (Cas9/dCas9 with visual indicators)
- Real-time analysis status updates
- **Tabbed interface**: All Results, Genome Browser, Risk Prioritization
- Genome browser-style linear visualization with configurable site limit
- **Virtual scrolling table** for efficient rendering of large result sets
- **Lazy-loading pagination** - fetch data only when needed
- Mermaid diagram for alignment visualization (top 50 sites)
- **Mode-specific result display** (PAM column, seed mismatch column, different scoring)
- **High-risk sites dashboard** with risk distribution statistics
- Detailed results table with mismatch highlighting
- One-click BED export

## CRISPR Modes

### CRISPRn (Cas9) - Cutting Mode
- **PAM Requirement**: NGG sequence required immediately downstream of gRNA
- **Scoring Metrics**:
  - **CFD Score**: Cutting Frequency Determination - based on mismatch position weights
  - **MIT Score**: MIT specificity score - based on PAM distance
  - **Aggregate Score**: Average of CFD and MIT
- **Use Case**: Gene knockout, indel introduction, double-strand break

### CRISPRa (dCas9) - Binding/Activation Mode
- **PAM Requirement**: None - finds all binding sites
- **Scoring Metrics**:
  - **Binding Score**: Based on mismatch position with special weight on seed region (positions 10-19)
  - **Seed Mismatches**: Number of mismatches in the critical seed region
  - **Seed Perfect**: Indicator of zero seed region mismatches (highest affinity)
- **Use Case**: Gene activation, epigenetic modification, locus imaging

## Risk Weighting System

| Feature | Risk Weight | Description |
|---------|-------------|-------------|
| CDS | 10.0 | Coding sequence - highest risk |
| 5'UTR | 5.0 | 5' untranslated region - high risk |
| 3'UTR | 3.0 | 3' untranslated region - medium risk |
| Exon | 2.0 | Exonic region |
| Intron | 1.0 | Intronic region |
| Intergenic | 0.1 | Intergenic region - lowest risk |

## Performance Optimizations

### Backend

1. **Chunked Storage**: Results are split into chunks (100 sites/chunk) and stored using pickle, avoiding loading entire large datasets into memory.
2. **Paginated API**:
   - `/api/results/{job_id}/page` - Fetch specific page with configurable page size (10-500 items)
   - `/api/results/{job_id}/top` - Fetch top N highest-scoring sites for visualization
   - `/api/results/{job_id}/metadata` - Get statistics without loading full results
   - `/api/upload/gtf` - Upload GTF/GFF annotation file
   - `/api/prioritize` - Start functional risk prioritization
   - `/api/prioritize/status/{job_id}` - Get prioritization status
   - `/api/prioritize/results/{job_id}` - Get prioritized results
3. **Efficient Serialization**: Using pickle instead of JSON for faster I/O and smaller file sizes
4. **Mode-Specific Logic**: Separate scoring and alignment algorithms for each CRISPR type

### Frontend

1. **Virtual Scrolling Table**: Only renders visible rows (~30 at a time), even for datasets with millions of sites.
2. **Lazy Data Loading**:
   - Initial load: Metadata + first page (100 items)
   - Scroll-triggered loading: Additional pages load as user scrolls
   - Page cache: Loaded pages remain cached in memory
3. **Genome Browser Optimization**:
   - Only load top N sites (configurable: 100-1000)
   - Smaller feature markers (6px width) for better visual density
   - Mermaid diagram limited to top 50 sites

## Project Structure

```
p43/
├── backend/
│   ├── aligner/          # Sequence alignment module
│   │   └── aligner.py    # Hamming distance + BWA-MEM wrapper + IUPAC support
│   ├── scorer/           # Scoring module
│   │   └── scorer.py     # CFD, MIT, and dCas9 binding scoring algorithms
│   ├── annotator/        # Annotation module
│   │   └── gtf_parser.py  # GTF parsing + functional risk prioritization
│   ├── api/              # API routes
│   │   └── routes.py     # FastAPI endpoint definitions (pagination, prioritization)
│   ├── workers/          # Async task workers
│   │   └── tasks.py      # Celery task definitions
│   ├── uploads/          # Uploaded FASTA files
│   │   └── gtf/         # Uploaded GTF/GFF files
│   ├── results/          # Analysis results (chunked)
│   ├── main.py           # FastAPI application entry
│   ├── config.py         # Configuration settings
│   └── requirements.txt  # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/   # Vue components
    │   │   ├── FileUpload.vue
    │   │   ├── GrnaInput.vue
    │   │   ├── AnalysisStatus.vue
    │   │   ├── GenomeBrowser.vue      # Optimized visualization
    │   │   ├── VirtualScrollTable.vue # Virtual scrolling table
    │   │   ├── ResultsTable.vue       # Main results view
    │   │   ├── GtfUpload.vue          # GTF upload + prioritization start
    │   │   └── HighRiskSites.vue     # High-risk sites dashboard
    │   ├── App.vue       # Main application component
    │   ├── main.js       # Vue entry point
    │   └── style.css     # Global styles
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## Installation & Usage

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at http://localhost:8000

API documentation: http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3000

## Testing the Application

1. Start both backend and frontend servers
2. Use the provided `test_genome.fasta` file for testing
3. Enter gRNA sequence: `GGCACTGCGGCTGGAGGTGG`
4. Click "Start Analysis"
5. View results in genome browser and table
6. (Optional) Upload a GTF file and run risk prioritization
7. Export results as BED file

## API Endpoints

### File Management
- `POST /api/upload` - Upload FASTA file
- `GET /api/uploads` - List uploaded files
- `DELETE /api/uploads/{filename}` - Delete uploaded file
- `POST /api/upload/gtf` - Upload GTF/GFF annotation file
- `GET /api/gtf` - List uploaded GTF files
- `DELETE /api/gtf/{filename}` - Delete GTF file

### Analysis
- `POST /api/analyze` - Start off-target analysis
- `GET /api/status/{job_id}` - Get analysis status

### Results (Paginated)
- `GET /api/results/{job_id}/metadata` - Get result statistics (counts, grna, etc.)
- `GET /api/results/{job_id}/page?page=0&page_size=100` - Fetch specific page
- `GET /api/results/{job_id}/top?limit=500` - Fetch top N sites
- `GET /api/results/{job_id}/all` - Fetch all results (use carefully for large datasets)

### Prioritization
- `POST /api/prioritize` - Start functional risk prioritization
- `GET /api/prioritize/status/{priority_job_id}` - Get prioritization status
- `GET /api/prioritize/results/{priority_job_id}` - Get prioritized results

### Export
- `GET /api/export/bed/{job_id}` - Export results as BED file

## Algorithms

### Off-Target Prediction

Uses Hamming distance to find all sites with ≤4 mismatches in both forward and reverse complement strands. Supports IUPAC degenerate bases in both gRNA and reference genome.

### Scoring Metrics

- **CFD Score**: Cutting Frequency Determination score, based on mismatch position
- **MIT Score**: MIT specificity score, based on distance from PAM
- **Aggregate Score**: Average of CFD and MIT scores
- **Binding Score**: (CRISPRa mode only) Based on binding affinity, with seed region weighted more heavily
- **Priority Score**: Combined functional risk weighted score (specificity × genomic feature weight)

### IUPAC Degenerate Base Matching

The system supports all standard IUPAC nucleotide codes:

| Code | Meaning | Complement |
|------|---------|------------|
| A | Adenine | T |
| T | Thymine | A |
| G | Guanine | C |
| C | Cytosine | G |
| R | A or G (puRine) | Y |
| Y | C or T (pyrimidine) | R |
| S | G or C (Strong) | S |
| W | A or T (Weak) | W |
| K | G or T (Keto) | M |
| M | A or C (aMino) | K |
| B | C, G, or T (not A) | V |
| D | A, G, or T (not C) | H |
| H | A, C, or T (not G) | D |
| V | A, C, or G (not T) | B |
| N | Any nucleotide | N |

