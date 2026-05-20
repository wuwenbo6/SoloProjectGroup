from pathlib import Path
from typing import Dict, List, Tuple, Optional
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import GRNA_LENGTH

class GenomicInterval:
    def __init__(self, chrom: str, start: int, end: int, strand: str = '.', feature_type: str = None, gene_id: str = None, gene_name: str = None):
        self.chrom = chrom
        self.start = start
        self.end = end
        self.strand = strand
        self.feature_type = feature_type
        self.gene_id = gene_id
        self.gene_name = gene_name
    
    def overlaps(self, other: 'GenomicInterval') -> bool:
        if self.chrom != other.chrom:
            return False
        return self.start <= other.end and other.start <= self.end
    
    def overlap_length(self, other: 'GenomicInterval') -> int:
        if not self.overlaps(other):
            return 0
        return min(self.end, other.end) - max(self.start, other.start) + 1

class GTFFeature(GenomicInterval):
    def __init__(self, chrom: str, feature_type: str, start: int, end: int, score: float, strand: str, frame: str, attributes: Dict[str, str]):
        gene_id = attributes.get('gene_id', '')
        gene_name = attributes.get('gene_name', attributes.get('gene_id', ''))
        super().__init__(chrom, start, end, strand, feature_type, gene_id, gene_name)
        self.score = score
        self.frame = frame
        self.attributes = attributes

class Gene:
    def __init__(self, gene_id: str, gene_name: str, chrom: str, start: int, end: int, strand: str):
        self.gene_id = gene_id
        self.gene_name = gene_name
        self.chrom = chrom
        self.start = start
        self.end = end
        self.strand = strand
        self.exons: List[GenomicInterval] = []
        self.cds: List[GenomicInterval] = []
        self.utr5: List[GenomicInterval] = []
        self.utr3: List[GenomicInterval] = []
    
    def add_feature(self, feature: GTFFeature):
        interval = GenomicInterval(feature.chrom, feature.start, feature.end, feature.strand, 
                                    feature.feature_type, self.gene_id, self.gene_name)
        if feature.feature_type == 'exon':
            self.exons.append(interval)
        elif feature.feature_type == 'CDS':
            self.cds.append(interval)
        elif feature.feature_type in ['UTR', 'five_prime_UTR', '5UTR']:
            self.utr5.append(interval)
        elif feature.feature_type in ['UTR', 'three_prime_UTR', '3UTR']:
            self.utr3.append(interval)

class GTFParser:
    def __init__(self, gtf_path: Path):
        self.gtf_path = gtf_path
        self.genes: Dict[str, Gene] = {}
        self.chromosomes: Dict[str, List[Gene]] = {}
        self._parse()
    
    def _parse(self):
        with open(self.gtf_path, 'r') as f:
            for line in f:
                if line.startswith('#'):
                    continue
                
                parts = line.strip().split('\t')
                if len(parts) < 9:
                    continue
                
                chrom = parts[0]
                source = parts[1]
                feature_type = parts[2]
                start = int(parts[3])
                end = int(parts[4])
                score = float(parts[5]) if parts[5] != '.' else 0.0
                strand = parts[6]
                frame = parts[7]
                attributes_str = parts[8]
                
                attributes = self._parse_attributes(attributes_str)
                gene_id = attributes.get('gene_id')
                
                if not gene_id:
                    continue
                
                feature = GTFFeature(chrom, feature_type, start, end, score, strand, frame, attributes)
                
                if feature_type == 'gene':
                    gene_name = attributes.get('gene_name', gene_id)
                    gene = Gene(gene_id, gene_name, chrom, start, end, strand)
                    self.genes[gene_id] = gene
                    if chrom not in self.chromosomes:
                        self.chromosomes[chrom] = []
                    self.chromosomes[chrom].append(gene)
                elif gene_id in self.genes:
                    self.genes[gene_id].add_feature(feature)
    
    def _parse_attributes(self, attributes_str: str) -> Dict[str, str]:
        attributes = {}
        for attr in attributes_str.split(';'):
            attr = attr.strip()
            if not attr:
                continue
            if ' ' in attr:
                key, value = attr.split(' ', 1)
                value = value.strip('"')
                attributes[key] = value
        return attributes
    
    def find_overlapping_genes(self, site: GenomicInterval) -> List[Gene]:
        overlapping = []
        if site.chrom not in self.chromosomes:
            return overlapping
        
        for gene in self.chromosomes[site.chrom]:
            if site.start <= gene.end and gene.start <= site.end:
                overlapping.append(gene)
        
        return overlapping

RISK_WEIGHTS = {
    'CDS': 10.0,
    'UTR5': 5.0,
    'UTR3': 3.0,
    'exon': 2.0,
    'intron': 1.0,
    'intergenic': 0.1
}

def calculate_functional_risk(site: GenomicInterval, gtf_parser: GTFParser) -> Dict:
    site_length = site.end - site.start + 1
    total_risk = 0.0
    overlapping_features = []
    max_feature_type = 'intergenic'
    max_risk = RISK_WEIGHTS['intergenic']
    
    genes = gtf_parser.find_overlapping_genes(site)
    
    for gene in genes:
        gene_overlap = 0
        
        for feature_type, feature_list in [('CDS', gene.cds), ('UTR5', gene.utr5), ('UTR3', gene.utr3), ('exon', gene.exons)]:
            for feature in feature_list:
                overlap = site.overlap_length(feature)
                if overlap > 0:
                    risk_contribution = (overlap / site_length) * RISK_WEIGHTS[feature_type]
                    total_risk += risk_contribution
                    gene_overlap += overlap
                    
                    if RISK_WEIGHTS[feature_type] > max_risk:
                        max_risk = RISK_WEIGHTS[feature_type]
                        max_feature_type = feature_type
                    
                    overlapping_features.append({
                        'gene_id': gene.gene_id,
                        'gene_name': gene.gene_name,
                        'feature_type': feature_type,
                        'overlap_bp': overlap,
                        'overlap_ratio': overlap / site_length
                    })
        
        if gene_overlap < site_length and len(gene.exons) > 0:
            intron_overlap = site_length - gene_overlap
            risk_contribution = (intron_overlap / site_length) * RISK_WEIGHTS['intron']
            total_risk += risk_contribution
    
    if total_risk == 0:
        total_risk = RISK_WEIGHTS['intergenic']
    
    return {
        'total_functional_risk': total_risk,
        'max_feature_type': max_feature_type,
        'overlapping_genes': overlapping_features,
        'gene_count': len(genes)
    }

def calculate_priority_score(offtarget: Dict, functional_risk: Dict) -> float:
    mode = offtarget.get('mode', 'crisprn')
    
    if mode == 'crispra':
        binding_score = offtarget.get('binding_score', 0) / 100.0
        priority = binding_score * functional_risk['total_functional_risk']
    else:
        aggregate_score = offtarget.get('aggregate_score', 0) / 100.0
        priority = aggregate_score * functional_risk['total_functional_risk']
    
    return round(priority * 100, 2)

def prioritize_offtargets(offtargets: List[Dict], gtf_parser: GTFParser, top_n: int = 100) -> List[Dict]:
    prioritized = []
    
    for ot in offtargets:
        site = GenomicInterval(
            chrom=ot['chromosome'],
            start=ot['position'],
            end=ot['position'] + GRNA_LENGTH - 1,
            strand=ot['strand']
        )
        
        functional_risk = calculate_functional_risk(site, gtf_parser)
        priority_score = calculate_priority_score(ot, functional_risk)
        
        ot_with_priority = ot.copy()
        ot_with_priority.update({
            'functional_risk': functional_risk,
            'priority_score': priority_score,
            'risk_category': _get_risk_category(priority_score)
        })
        
        prioritized.append(ot_with_priority)
    
    prioritized.sort(key=lambda x: x['priority_score'], reverse=True)
    
    return prioritized[:top_n]

def _get_risk_category(priority_score: float) -> str:
    if priority_score >= 80:
        return 'CRITICAL'
    elif priority_score >= 50:
        return 'HIGH'
    elif priority_score >= 20:
        return 'MEDIUM'
    else:
        return 'LOW'
