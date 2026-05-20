from typing import List, Dict, Tuple
import re


def parse_fasta(content: str) -> List[Dict[str, str]]:
    sequences = []
    current_header = None
    current_sequence = []
    
    lines = content.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.startswith('>'):
            if current_header is not None:
                sequences.append({
                    'header': current_header,
                    'sequence': ''.join(current_sequence)
                })
            current_header = line[1:].strip()
            current_sequence = []
        else:
            current_sequence.append(line.upper())
    
    if current_header is not None:
        sequences.append({
            'header': current_header,
            'sequence': ''.join(current_sequence)
        })
    
    return sequences


def validate_dna(sequence: str) -> bool:
    pattern = r'^[ATGCNatgcn]+$'
    return bool(re.match(pattern, sequence))


def validate_protein(sequence: str) -> bool:
    pattern = r'^[ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy]+$'
    return bool(re.match(pattern, sequence))


def guess_sequence_type(sequence: str) -> str:
    seq = sequence.upper()
    dna_chars = set('ATGCN')
    protein_chars = set('ACDEFGHIKLMNPQRSTVWY')
    
    seq_chars = set(seq)
    
    if seq_chars.issubset(dna_chars):
        return 'DNA'
    elif seq_chars.issubset(protein_chars):
        return 'PROTEIN'
    else:
        return 'UNKNOWN'


def format_fasta(header: str, sequence: str, line_length: int = 80) -> str:
    lines = [f'>{header}']
    for i in range(0, len(sequence), line_length):
        lines.append(sequence[i:i + line_length])
    return '\n'.join(lines)


def calculate_gc_content(sequence: str) -> float:
    seq = sequence.upper()
    gc = seq.count('G') + seq.count('C')
    total = len(seq) - seq.count('N')
    return gc / total if total > 0 else 0.0
