from celery import Celery
from pathlib import Path
import json
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import UPLOAD_DIR, RESULT_DIR
from aligner.aligner import find_offtargets
from scorer.scorer import score_offtargets

celery = Celery(
    'tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

@celery.task(bind=True)
def analyze_offtargets_task(self, grna: str, fasta_filename: str, use_bwa: bool = True):
    self.update_state(state='PROGRESS', meta={'status': 'starting'})
    
    try:
        fasta_path = UPLOAD_DIR / fasta_filename
        if not fasta_path.exists():
            raise FileNotFoundError("FASTA file not found")
        
        self.update_state(state='PROGRESS', meta={'status': 'aligning'})
        offtargets = find_offtargets(grna, fasta_path, use_bwa)
        
        self.update_state(state='PROGRESS', meta={'status': 'scoring'})
        scored = score_offtargets(grna, offtargets)
        
        job_id = analyze_offtargets_task.request.id
        result_path = RESULT_DIR / f"{job_id}.json"
        with open(result_path, 'w') as f:
            json.dump({
                "grna": grna,
                "fasta_file": fasta_filename,
                "offtargets": scored
            }, f, indent=2)
        
        return {
            'status': 'completed',
            'grna': grna,
            'total_offtargets': len(scored),
            'offtargets': scored
        }
    except Exception as e:
        return {
            'status': 'failed',
            'error': str(e)
        }
