from typing import List, Dict, Tuple
import re
from collections import defaultdict


class CRISPRFinder:
    """CRISPR sequence identification using pattern matching"""
    
    def __init__(self):
        self.spacer_patterns = [
            r'G[A-Z]{32}G[A-Z]T',
            r'[A-Z]{21}GG',
            r'[A-Z]{20}GG',
        ]
        
        self.pam_patterns = {
            'SpCas9': r'[A|T]GG',
            'Cas12a': r'TT[C|T]N',
            'Cas9': r'[A|T]GG',
            'NGG': r'[A-Z]GG',
        }
        
        self.repeat_patterns = [
            r'GTTTT[A-Z]{15,30}GAAAAC',
            r'[A-Z]{20,40}',
        ]
    
    def find_pam_sites(self, sequence: str, pam_type: str = 'SpCas9') -> List[Dict]:
        """Find PAM sites in the sequence"""
        pattern = self.pam_patterns.get(pam_type, self.pam_patterns['SpCas9'])
        
        matches = []
        seq_len = len(sequence)
        
        for i in range(seq_len - 3):
            window = sequence[i:i + 3]
            if re.match(pattern, window):
                spacer_start = max(0, i - 20)
                spacer_end = i
                spacer = sequence[spacer_start:spacer_end]
                
                matches.append({
                    'position': i,
                    'pam_sequence': window,
                    'spacer_sequence': spacer,
                    'spacer_length': len(spacer),
                    'strand': '+' if i + 3 <= seq_len else '-',
                    'pam_type': pam_type
                })
        
        for i in range(seq_len - 3, -1, -1):
            window = sequence[i:i + 3]
            rc_window = self._reverse_complement(window)
            if re.match(pattern, rc_window):
                spacer_start = i + 3
                spacer_end = min(seq_len, i + 23)
                spacer = sequence[spacer_start:spacer_end]
                
                matches.append({
                    'position': i,
                    'pam_sequence': window,
                    'spacer_sequence': self._reverse_complement(spacer),
                    'spacer_length': len(spacer),
                    'strand': '-',
                    'pam_type': pam_type
                })
        
        return matches
    
    def find_all_pam_types(self, sequence: str) -> List[Dict]:
        """Find all PAM site types"""
        all_matches = []
        for pam_type in self.pam_patterns.keys():
            matches = self.find_pam_sites(sequence, pam_type)
            all_matches.extend(matches)
        return all_matches
    
    def find_crispr_repeats(self, sequence: str) -> List[Dict]:
        """Find CRISPR repeat regions"""
        repeats = []
        seq_len = len(sequence)
        
        repeat_len = 28
        
        for i in range(seq_len - repeat_len * 2):
            for j in range(i + repeat_len, seq_len - repeat_len):
                repeat1 = sequence[i:i + repeat_len]
                repeat2 = sequence[j:j + repeat_len]
                
                identity = self._calculate_identity(repeat1, repeat2)
                
                if identity > 0.8:
                    spacer = sequence[i + repeat_len:j]
                    
                    repeats.append({
                        'repeat_start': i,
                        'repeat_end': j + repeat_len,
                        'repeat_sequence_1': repeat1,
                        'repeat_sequence_2': repeat2,
                        'spacer_sequence': spacer,
                        'spacer_length': len(spacer),
                        'identity': identity
                    })
        
        repeats = sorted(repeats, key=lambda x: x['identity'], reverse=True)
        return repeats[:10]
    
    def find_crispr_arrays(self, sequence: str) -> List[Dict]:
        """Find CRISPR arrays (multiple repeats)"""
        arrays = []
        
        pam_sites = self.find_all_pam_types(sequence)
        
        if pam_sites:
            pam_groups = defaultdict(list)
            for pam in pam_sites:
                pam_groups[pam['pam_type']].append(pam)
            
            for pam_type, sites in pam_groups.items():
                if len(sites) >= 2:
                    arrays.append({
                        'pam_type': pam_type,
                        'num_sites': len(sites),
                        'sites': sites[:5],
                        'positions': [s['position'] for s in sites]
                    })
        
        return arrays
    
    def _reverse_complement(self, sequence: str) -> str:
        """Calculate reverse complement"""
        complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g'
        }
        return ''.join([complement.get(base, base) for base in reversed(sequence)])
    
    def _calculate_identity(self, seq1: str, seq2: str) -> float:
        """Calculate sequence identity"""
        if len(seq1) != len(seq2):
            return 0.0
        
        matches = sum(1 for a, b in zip(seq1, seq2) if a == b)
        return matches / len(seq1)
    
    def analyze_sequence(self, sequence: str) -> Dict:
        """Comprehensive CRISPR analysis"""
        pam_sites = self.find_all_pam_types(sequence)
        repeats = self.find_crispr_repeats(sequence)
        arrays = self.find_crispr_arrays(sequence)
        
        pam_by_type = defaultdict(list)
        for pam in pam_sites:
            pam_by_type[pam['pam_type']].append(pam)
        
        return {
            'sequence_length': len(sequence),
            'total_pam_sites': len(pam_sites),
            'pam_sites_by_type': {k: len(v) for k, v in pam_by_type.items()},
            'pam_sites': pam_sites[:20],
            'crispr_repeats': repeats[:5],
            'crispr_arrays': arrays,
            'gc_content': self._calculate_gc(sequence)
        }
    
    def _calculate_gc(self, sequence: str) -> float:
        """Calculate GC content"""
        if len(sequence) == 0:
            return 0.0
        gc = sequence.upper().count('G') + sequence.upper().count('C')
        return gc / len(sequence)


def find_crispr_sites(sequence: str) -> Dict:
    """Convenience function to find CRISPR sites"""
    finder = CRISPRFinder()
    return finder.analyze_sequence(sequence)


def find_pam_sites(sequence: str, pam_type: str = 'SpCas9') -> List[Dict]:
    """Convenience function to find PAM sites"""
    finder = CRISPRFinder()
    return finder.find_pam_sites(sequence, pam_type)
