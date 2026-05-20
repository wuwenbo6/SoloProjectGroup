from typing import List, Dict
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from config import GRNA_LENGTH, CRISPR_MODE_CAS9, CRISPR_MODE_DCAS9

def calculate_cfd_score(grna: str, target: str, mismatches: List[int]) -> float:
    position_weights = {
        0: 0.9, 1: 0.9, 2: 0.9, 3: 0.9, 4: 0.9,
        5: 0.8, 6: 0.8, 7: 0.8, 8: 0.8, 9: 0.8,
        10: 0.7, 11: 0.7, 12: 0.7, 13: 0.7, 14: 0.7,
        15: 0.6, 16: 0.6, 17: 0.6, 18: 0.5, 19: 0.5
    }
    
    mismatch_penalty = 1.0
    for pos in mismatches:
        weight = position_weights.get(pos, 0.5)
        mismatch_penalty *= weight
    
    return mismatch_penalty * 100

def calculate_mit_score(grna: str, target: str, mismatches: List[int]) -> float:
    if not mismatches:
        return 100.0
    
    pam_distances = [GRNA_LENGTH - 1 - m for m in mismatches]
    
    weights = []
    for d in pam_distances:
        if d <= 5:
            weights.append(0.1)
        elif d <= 10:
            weights.append(0.3)
        elif d <= 15:
            weights.append(0.6)
        else:
            weights.append(0.8)
    
    avg_weight = sum(weights) / len(weights) if weights else 1.0
    
    mismatch_factor = 1.0 / (1 + len(mismatches))
    
    return avg_weight * mismatch_factor * 100

def calculate_dcas9_binding_score(grna: str, target: str, mismatches: List[int]) -> Dict[str, float]:
    seed_region_weights = {i: 0.5 for i in range(10, 20)}
    non_seed_weights = {i: 0.9 for i in range(10)}
    position_weights = {**non_seed_weights, **seed_region_weights}
    
    binding_penalty = 1.0
    seed_mismatches = 0
    non_seed_mismatches = 0
    
    for pos in mismatches:
        weight = position_weights.get(pos, 0.7)
        binding_penalty *= weight
        if pos >= 10:
            seed_mismatches += 1
        else:
            non_seed_mismatches += 1
    
    binding_score = binding_penalty * 100
    
    seed_perfect = seed_mismatches == 0
    
    accessibility_factor = 1.0
    if not seed_perfect:
        accessibility_factor *= 0.5
    
    final_score = binding_score * accessibility_factor
    
    return {
        'binding_score': round(final_score, 2),
        'seed_mismatches': seed_mismatches,
        'non_seed_mismatches': non_seed_mismatches,
        'seed_perfect': seed_perfect
    }

def calculate_aggregate_score(grna: str, target: str, mismatches: List[int], mode: str = CRISPR_MODE_CAS9) -> Dict[str, float]:
    if mode == CRISPR_MODE_DCAS9:
        return calculate_dcas9_binding_score(grna, target, mismatches)
    
    cfd = calculate_cfd_score(grna, target, mismatches)
    mit = calculate_mit_score(grna, target, mismatches)
    
    aggregate = (cfd + mit) / 2
    
    return {
        'cfd_score': round(cfd, 2),
        'mit_score': round(mit, 2),
        'aggregate_score': round(aggregate, 2)
    }

def score_offtargets(grna: str, offtargets: List[Dict], mode: str = CRISPR_MODE_CAS9) -> List[Dict]:
    scored = []
    for ot in offtargets:
        scores = calculate_aggregate_score(grna, ot['sequence'], ot['mismatch_positions'], mode)
        ot.update(scores)
        scored.append(ot)
    
    if mode == CRISPR_MODE_DCAS9:
        return sorted(scored, key=lambda x: x['binding_score'], reverse=True)
    return sorted(scored, key=lambda x: x['aggregate_score'], reverse=True)

def export_bed(offtargets: List[Dict], output_path: Path, grna_name: str = "gRNA"):
    with open(output_path, 'w') as f:
        for ot in offtargets:
            chrom = ot['chromosome']
            start = ot['position'] - 1
            end = ot['position'] + GRNA_LENGTH - 1
            
            mode = ot.get('mode', CRISPR_MODE_CAS9)
            if mode == CRISPR_MODE_DCAS9:
                score = int(ot['binding_score'])
            else:
                score = int(ot['aggregate_score'])
            
            name = f"{grna_name}_{mode}_{'ontarget' if ot['is_ontarget'] else 'offtarget'}_{ot['mismatch_count']}mm"
            strand = ot['strand']
            
            f.write(f"{chrom}\t{start}\t{end}\t{name}\t{score}\t{strand}\n")
