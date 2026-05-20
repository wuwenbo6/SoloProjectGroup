import json
import csv
from io import StringIO
from typing import List, Dict, Any


class ExportService:
    @staticmethod
    def export_to_json(data: Any, pretty: bool = True) -> str:
        """Export data to JSON format"""
        indent = 2 if pretty else None
        return json.dumps(data, indent=indent, ensure_ascii=False, default=str)
    
    @staticmethod
    def export_to_csv(data: List[Dict], fieldnames: List[str] = None) -> str:
        """Export data to CSV format"""
        if not data:
            return ''
        
        output = StringIO()
        
        if fieldnames is None:
            fieldnames = list(data[0].keys())
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in data:
            writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    def export_alignment_results(results: List[Dict], format_type: str = 'json') -> str:
        """Export alignment results to specified format"""
        if format_type == 'json':
            return ExportService.export_to_json(results)
        
        elif format_type == 'csv':
            flattened = []
            for hit in results:
                flattened.append({
                    'seq_id': hit.get('seq_id', ''),
                    'query_start': hit.get('query_start', 0),
                    'query_end': hit.get('query_end', 0),
                    'subject_start': hit.get('subject_start', 0),
                    'subject_end': hit.get('subject_end', 0),
                    'score': hit.get('score', 0),
                    'identity': hit.get('identity', 0),
                    'evalue': hit.get('evalue', 0),
                    'aligned_query': hit.get('aligned_query', ''),
                    'aligned_subject': hit.get('aligned_subject', '')
                })
            return ExportService.export_to_csv(flattened)
        
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    @staticmethod
    def export_clustering_results(clusters: List[Dict], format_type: str = 'json') -> str:
        """Export clustering results to specified format"""
        if format_type == 'json':
            return ExportService.export_to_json(clusters)
        
        elif format_type == 'csv':
            flattened = []
            for cluster in clusters:
                rep = cluster['representative']
                flattened.append({
                    'cluster_id': cluster.get('cluster_id', 0),
                    'cluster_size': cluster.get('size', 0),
                    'avg_length': cluster.get('avg_length', 0),
                    'representative_id': rep.get('seq_id', ''),
                    'representative_header': rep.get('header', ''),
                    'representative_length': rep.get('length', 0),
                    'representative_sequence': rep.get('sequence', ''),
                    'num_members': len(cluster.get('members', []))
                })
            return ExportService.export_to_csv(flattened)
        
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    @staticmethod
    def export_crispr_results(crispr_data: Dict, format_type: str = 'json') -> str:
        """Export CRISPR analysis results to specified format"""
        if format_type == 'json':
            return ExportService.export_to_json(crispr_data)
        
        elif format_type == 'csv':
            flattened = []
            pam_sites = crispr_data.get('pam_sites', [])
            
            for pam in pam_sites:
                flattened.append({
                    'position': pam.get('position', 0),
                    'pam_sequence': pam.get('pam_sequence', ''),
                    'spacer_sequence': pam.get('spacer_sequence', ''),
                    'spacer_length': pam.get('spacer_length', 0),
                    'strand': pam.get('strand', ''),
                    'pam_type': pam.get('pam_type', '')
                })
            
            return ExportService.export_to_csv(flattened)
        
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    @staticmethod
    def export_sequences(sequences: List[Dict], format_type: str = 'json') -> str:
        """Export sequences to specified format"""
        if format_type == 'json':
            return ExportService.export_to_json(sequences)
        
        elif format_type == 'csv':
            return ExportService.export_to_csv(sequences)
        
        elif format_type == 'fasta':
            fasta_lines = []
            for seq in sequences:
                header = seq.get('header', seq.get('seq_id', ''))
                sequence = seq.get('sequence', '')
                fasta_lines.append(f">{header}")
                fasta_lines.append(sequence)
            return '\n'.join(fasta_lines)
        
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    @staticmethod
    def export_cluster_representatives(clusters: List[Dict], format_type: str = 'json') -> str:
        """Export cluster representative sequences"""
        representatives = [cluster['representative'] for cluster in clusters]
        return ExportService.export_sequences(representatives, format_type)
    
    @staticmethod
    def generate_export_summary(clusters: List[Dict], crispr_results: Dict = None, alignment_results: List[Dict] = None) -> Dict:
        """Generate export summary"""
        summary = {
            'num_clusters': len(clusters),
            'total_sequences': sum(c.get('size', 0) for c in clusters),
            'avg_cluster_size': sum(c.get('size', 0) for c in clusters) / len(clusters) if clusters else 0
        }
        
        if crispr_results:
            summary['crispr_analysis'] = {
                'sequence_length': crispr_results.get('sequence_length', 0),
                'total_pam_sites': crispr_results.get('total_pam_sites', 0),
                'pam_sites_by_type': crispr_results.get('pam_sites_by_type', {})
            }
        
        if alignment_results:
            summary['alignment_results'] = {
                'num_hits': len(alignment_results),
                'avg_identity': sum(h.get('identity', 0) for h in alignment_results) / len(alignment_results) if alignment_results else 0
            }
        
        return summary
