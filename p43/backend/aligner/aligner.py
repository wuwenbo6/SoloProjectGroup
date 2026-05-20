import subprocess
import tempfile
import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Set
from Bio import SeqIO
from Bio.Seq import Seq
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import MAX_MISMATCHES, GRNA_LENGTH, BWA_PATH, BWA_AVAILABLE, CRISPR_MODE_CAS9, CRISPR_MODE_DCAS9, PAM_SEQUENCE, PAM_LENGTH

IUPAC_CODES = {
    'A': {'A'},
    'T': {'T'},
    'G': {'G'},
    'C': {'C'},
    'R': {'A', 'G'},
    'Y': {'C', 'T'},
    'S': {'G', 'C'},
    'W': {'A', 'T'},
    'K': {'G', 'T'},
    'M': {'A', 'C'},
    'B': {'C', 'G', 'T'},
    'D': {'A', 'G', 'T'},
    'H': {'A', 'C', 'T'},
    'V': {'A', 'C', 'G'},
    'N': {'A', 'T', 'G', 'C'}
}

def base_match(base1: str, base2: str) -> bool:
    b1 = base1.upper()
    b2 = base2.upper()
    
    set1 = IUPAC_CODES.get(b1, {b1})
    set2 = IUPAC_CODES.get(b2, {b2})
    
    return len(set1 & set2) > 0

def hamming_distance(s1: str, s2: str) -> Tuple[int, List[int]]:
    if len(s1) != len(s2):
        raise ValueError("Sequences must have the same length")
    mismatches = []
    distance = 0
    for i, (a, b) in enumerate(zip(s1.upper(), s2.upper())):
        if not base_match(a, b):
            distance += 1
            mismatches.append(i)
    return distance, mismatches

def check_pam(pam_sequence: str) -> bool:
    for i, pam_base in enumerate(PAM_SEQUENCE.upper()):
        if i >= len(pam_sequence):
            return False
        seq_base = pam_sequence[i].upper()
        if not base_match(pam_base, seq_base):
            return False
    return True

def find_offtargets_bruteforce(grna: str, fasta_path: Path, mode: str = CRISPR_MODE_CAS9) -> List[Dict]:
    grna = grna.upper()
    if len(grna) != GRNA_LENGTH:
        raise ValueError(f"gRNA must be {GRNA_LENGTH}bp")
    
    results = []
    complement = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'}
    
    search_length = GRNA_LENGTH + (PAM_LENGTH if mode == CRISPR_MODE_CAS9 else 0)
    
    for record in SeqIO.parse(fasta_path, "fasta"):
        seq = str(record.seq).upper()
        chrom = record.id
        
        for strand in ['+', '-']:
            search_seq = seq if strand == '+' else ''.join([complement.get(c, c) for c in reversed(seq)])
            
            if len(search_seq) < search_length:
                continue
                
            for i in range(len(search_seq) - search_length + 1):
                window = search_seq[i:i + GRNA_LENGTH]
                if 'N' in window:
                    continue
                
                if mode == CRISPR_MODE_CAS9:
                    pam_seq = search_seq[i + GRNA_LENGTH:i + GRNA_LENGTH + PAM_LENGTH]
                    if len(pam_seq) < PAM_LENGTH or not check_pam(pam_seq):
                        continue
                
                distance, mismatches = hamming_distance(grna, window)
                
                if distance <= MAX_MISMATCHES:
                    pos = i + 1 if strand == '+' else len(seq) - i
                    
                    result = {
                        'chromosome': chrom,
                        'position': pos,
                        'strand': strand,
                        'sequence': window,
                        'mismatch_count': distance,
                        'mismatch_positions': mismatches,
                        'is_ontarget': distance == 0,
                        'mode': mode
                    }
                    
                    if mode == CRISPR_MODE_CAS9:
                        pam_seq = search_seq[i + GRNA_LENGTH:i + GRNA_LENGTH + PAM_LENGTH]
                        result['pam'] = pam_seq
                    
                    results.append(result)
    
    return sorted(results, key=lambda x: x['mismatch_count'])

def index_fasta(fasta_path: Path) -> bool:
    if not BWA_AVAILABLE:
        return False
    
    try:
        subprocess.run(
            [BWA_PATH, 'index', str(fasta_path)],
            capture_output=True,
            check=True,
            timeout=300
        )
        return True
    except:
        return False

def find_offtargets_bwa(grna: str, fasta_path: Path, mode: str = CRISPR_MODE_CAS9) -> List[Dict]:
    if not BWA_AVAILABLE:
        return find_offtargets_bruteforce(grna, fasta_path, mode)
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.fa', delete=False) as f:
        f.write(f">grna\n{grna}\n")
        query_fasta = Path(f.name)
    
    try:
        sam_output = subprocess.run(
            [BWA_PATH, 'mem', '-k', '10', '-T', '10', str(fasta_path), str(query_fasta)],
            capture_output=True,
            text=True,
            timeout=300
        ).stdout
        
        results = []
        for line in sam_output.split('\n'):
            if line.startswith('@') or not line.strip():
                continue
                
            parts = line.split('\t')
            if len(parts) < 11:
                continue
                
            flag = int(parts[1])
            if flag & 4:
                continue
                
            chrom = parts[2]
            pos = int(parts[3])
            seq = parts[9]
            strand = '-' if flag & 16 else '+'
            
            if len(seq) != GRNA_LENGTH:
                continue
                
            md_tag = None
            for part in parts[11:]:
                if part.startswith('MD:Z:'):
                    md_tag = part[5:]
                    break
            
            mismatches = []
            if md_tag:
                ref_pos = 0
                i = 0
                while i < len(md_tag):
                    if md_tag[i].isdigit():
                        num = ''
                        while i < len(md_tag) and md_tag[i].isdigit():
                            num += md_tag[i]
                            i += 1
                        ref_pos += int(num)
                    elif md_tag[i] == '^':
                        i += 1
                        while i < len(md_tag) and not md_tag[i].isdigit():
                            i += 1
                    else:
                        mismatches.append(ref_pos)
                        ref_pos += 1
                        i += 1
            
            mismatch_count = len(mismatches)
            if mismatch_count <= MAX_MISMATCHES:
                result = {
                    'chromosome': chrom,
                    'position': pos,
                    'strand': strand,
                    'sequence': seq,
                    'mismatch_count': mismatch_count,
                    'mismatch_positions': mismatches,
                    'is_ontarget': mismatch_count == 0,
                    'mode': mode
                }
                results.append(result)
        
        return sorted(results, key=lambda x: x['mismatch_count'])
        
    finally:
        query_fasta.unlink()

def find_offtargets(grna: str, fasta_path: Path, mode: str = CRISPR_MODE_CAS9, use_bwa: bool = True) -> List[Dict]:
    if use_bwa and BWA_AVAILABLE:
        return find_offtargets_bwa(grna, fasta_path, mode)
    return find_offtargets_bruteforce(grna, fasta_path, mode)
