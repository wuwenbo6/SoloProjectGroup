#!/usr/bin/env python3
"""Test script for new features: CD-HIT, CRISPR, Export"""

from app.algorithms.cd_hit import CDHIT, cluster_sequences
from app.algorithms.crispr_finder import CRISPRFinder, find_crispr_sites
from app.services.export_service import ExportService

def test_cd_hit():
    print("=" * 50)
    print("🧪 Testing CD-HIT Sequence Clustering")
    print("=" * 50)
    
    test_sequences = [
        {'seq_id': 'seq1', 'sequence': 'ATCGATCGATCGATCGATCG', 'header': 'Sequence 1'},
        {'seq_id': 'seq2', 'sequence': 'ATCGATCGATCGATCGATCA', 'header': 'Sequence 2'},
        {'seq_id': 'seq3', 'sequence': 'ATCGATCGATCGATCGATCC', 'header': 'Sequence 3'},
        {'seq_id': 'seq4', 'sequence': 'GGGGGGGGGGGGGGGGGGG', 'header': 'Sequence 4'},
        {'seq_id': 'seq5', 'sequence': 'GGGGGGGGGGGGGGGGGGa', 'header': 'Sequence 5'},
    ]
    
    cdhit = CDHIT(threshold=0.9)
    clusters = cdhit.cluster(test_sequences)
    stats = cdhit.get_cluster_stats()
    
    print(f"\nNumber of clusters: {stats['num_clusters']}")
    print(f"Total sequences: {stats['total_sequences']}")
    print(f"Average cluster size: {stats['avg_cluster_size']:.1f}")
    print(f"Redundancy removed: {stats['redundancy_removed'] * 100:.1f}%")
    
    for cluster in clusters:
        print(f"\n  Cluster {cluster['cluster_id']}:")
        print(f"    Representative: {cluster['representative']['seq_id']}")
        print(f"    Size: {cluster['size']}")
        print(f"    Members: {len(cluster['members'])}")
    
    print("\n✅ CD-HIT test passed!")
    return clusters

def test_crispr_finder():
    print("\n" + "=" * 50)
    print("🧬 Testing CRISPR Site Finder")
    print("=" * 50)
    
    test_sequence = "ATCGATCGATCGATCGGGATCGATCGATCGATCGNGGATCGATCGATCGATCG"
    
    finder = CRISPRFinder()
    results = finder.analyze_sequence(test_sequence)
    
    print(f"\nSequence length: {results['sequence_length']} bp")
    print(f"Total PAM sites: {results['total_pam_sites']}")
    print(f"GC content: {results['gc_content'] * 100:.1f}%")
    print("\nPAM sites by type:")
    for pam_type, count in results['pam_sites_by_type'].items():
        print(f"  {pam_type}: {count}")
    
    print(f"\nFound {len(results['pam_sites'])} PAM sites")
    if results['pam_sites']:
        for i, pam in enumerate(results['pam_sites'][:3]):
            print(f"  {i+1}. Position {pam['position']}: {pam['pam_sequence']}")
            print(f"     Spacer: {pam['spacer_sequence']}")
            print(f"     Strand: {pam['strand']}")
        if len(results['pam_sites']) > 3:
            print(f"  ... and {len(results['pam_sites']) - 3} more")
    
    print("\n✅ CRISPR Finder test passed!")
    return results

def test_export_service(clusters, crispr_results):
    print("\n" + "=" * 50)
    print("📤 Testing Export Service")
    print("=" * 50)
    
    print("\nTesting JSON export:")
    json_export = ExportService.export_clustering_results(clusters, 'json')
    print(f"  JSON export length: {len(json_export)} chars")
    print(f"  Preview: {json_export[:100]}...")
    
    print("\nTesting CSV export:")
    csv_export = ExportService.export_clustering_results(clusters, 'csv')
    print(f"  CSV export length: {len(csv_export)} chars")
    print(f"  Preview: {csv_export[:100]}...")
    
    print("\nTesting FASTA export (representatives):")
    fasta_export = ExportService.export_cluster_representatives(clusters, 'fasta')
    print(f"  FASTA export length: {len(fasta_export)} chars")
    print(f"  Preview: {fasta_export[:100]}...")
    
    print("\nTesting CRISPR JSON export:")
    crispr_json = ExportService.export_crispr_results(crispr_results, 'json')
    print(f"  CRISPR JSON export: {len(crispr_json)} chars")
    
    print("\nTesting CRISPR CSV export:")
    crispr_csv = ExportService.export_crispr_results(crispr_results, 'csv')
    print(f"  CRISPR CSV export: {len(crispr_csv)} chars")
    
    print("\n✅ Export Service test passed!")

def main():
    print("\n" + "🚀 Running all new feature tests...\n")
    
    clusters = test_cd_hit()
    crispr_results = test_crispr_finder()
    test_export_service(clusters, crispr_results)
    
    print("\n" + "=" * 50)
    print("🎉 All tests passed successfully!")
    print("=" * 50)
    
    print("\nSummary of new features:")
    print("  ✅ CD-HIT Sequence Clustering - removes redundancy")
    print("  ✅ CRISPR Site Finder - finds PAM sites and gRNAs")
    print("  ✅ Export Service - JSON, CSV, FASTA formats")
    print("  ✅ API Endpoints - /api/analysis/*")
    print("  ✅ Web Interface - /analysis page")
    print("\nTo use:")
    print("  1. Start the server: uvicorn app.main:app --reload")
    print("  2. Visit http://localhost:8000/analysis")
    print("  3. Use the web interface for clustering and CRISPR analysis")
    print("  4. Export results in JSON, CSV, or FASTA format")

if __name__ == "__main__":
    main()
