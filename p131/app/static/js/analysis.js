let currentClusteringResults = null;
let currentCRISPRResults = null;

function showAnalysisTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`.tab-btn[onclick="showAnalysisTab('${tabName}')"]`).classList.add('active');
}

document.getElementById('cluster-source').addEventListener('change', function(e) {
    document.getElementById('cluster-file-upload').style.display = e.target.value === 'file' ? 'block' : 'none';
});

document.getElementById('crispr-source').addEventListener('change', function(e) {
    document.getElementById('crispr-sequence-input').style.display = e.target.value === 'sequence' ? 'block' : 'none';
    document.getElementById('crispr-file-upload').style.display = e.target.value === 'file' ? 'block' : 'none';
});

async function runClustering() {
    const resultsDiv = document.getElementById('cluster-results');
    resultsDiv.innerHTML = '<p class="loading">⏳ Running clustering analysis...</p>';
    
    try {
        const source = document.getElementById('cluster-source').value;
        const seqType = document.getElementById('cluster-seq-type').value;
        const threshold = parseFloat(document.getElementById('cluster-threshold').value);
        
        let url = `/api/analysis/cluster?seq_type=${seqType}&threshold=${threshold}`;
        let options = { method: 'POST' };
        
        if (source === 'file') {
            const fileInput = document.getElementById('cluster-fasta-file');
            if (!fileInput.files[0]) {
                resultsDiv.innerHTML = '<p class="error">Please select a FASTA file</p>';
                return;
            }
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            options.body = formData;
        }
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (response.ok) {
            currentClusteringResults = data;
            displayClusteringResults(data);
        } else {
            resultsDiv.innerHTML = `<p class="error">❌ ${data.detail || 'Error running clustering'}</p>`;
        }
    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
    }
}

function displayClusteringResults(data) {
    const resultsDiv = document.getElementById('cluster-results');
    const stats = data.statistics;
    
    let html = `
        <div class="stats-summary">
            <div class="stat-item">
                <span class="stat-value">${stats.num_clusters}</span>
                <span class="stat-label">Clusters</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.total_sequences}</span>
                <span class="stat-label">Total Sequences</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.avg_cluster_size.toFixed(1)}</span>
                <span class="stat-label">Avg Cluster Size</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${(stats.redundancy_removed * 100).toFixed(1)}%</span>
                <span class="stat-label">Redundancy Removed</span>
            </div>
        </div>
        
        <h3>Clusters</h3>
    `;
    
    data.clusters.slice(0, 10).forEach(cluster => {
        const rep = cluster.representative;
        html += `
            <div class="cluster-card">
                <div class="cluster-header">
                    <span class="cluster-id">Cluster ${cluster.cluster_id}</span>
                    <span class="cluster-size">Size: ${cluster.size}</span>
                </div>
                <div class="cluster-info">
                    <p><strong>Representative:</strong> ${rep.seq_id} (${rep.length} bp)</p>
                    <p><strong>Avg Length:</strong> ${cluster.avg_length.toFixed(1)} bp</p>
                    ${cluster.members.length > 0 ? `<p><strong>Members:</strong> ${cluster.members.length} sequences</p>` : ''}
                </div>
            </div>
        `;
    });
    
    if (data.clusters.length > 10) {
        html += `<p style="text-align: center; color: #666;">Showing 10 of ${data.clusters.length} clusters</p>`;
    }
    
    resultsDiv.innerHTML = html;
}

async function exportClustering(format) {
    const source = document.getElementById('cluster-source').value;
    const seqType = document.getElementById('cluster-seq-type').value;
    const threshold = parseFloat(document.getElementById('cluster-threshold').value);
    
    let url = `/api/analysis/cluster/export?seq_type=${seqType}&threshold=${threshold}&format_type=${format}`;
    
    if (currentClusteringResults && format === 'fasta') {
        url += '&export_type=representatives';
    }
    
    let options = { method: 'POST' };
    
    if (source === 'file') {
        const fileInput = document.getElementById('cluster-fasta-file');
        if (!fileInput.files[0]) {
            alert('Please select a FASTA file first');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        options.body = formData;
    }
    
    const response = await fetch(url, options);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `clustering_results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function runCRISPR() {
    const resultsDiv = document.getElementById('crispr-results');
    resultsDiv.innerHTML = '<p class="loading">⏳ Analyzing CRISPR sites...</p>';
    
    try {
        const source = document.getElementById('crispr-source').value;
        const pamType = document.getElementById('crispr-pam-type').value;
        
        let url = `/api/analysis/crispr?pam_type=${pamType}`;
        let options = { method: 'POST' };
        
        if (source === 'file') {
            const fileInput = document.getElementById('crispr-fasta-file');
            if (!fileInput.files[0]) {
                resultsDiv.innerHTML = '<p class="error">Please select a FASTA file</p>';
                return;
            }
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            options.body = formData;
        } else {
            const sequence = document.getElementById('crispr-sequence').value;
            if (!sequence) {
                resultsDiv.innerHTML = '<p class="error">Please enter a sequence</p>';
                return;
            }
            
            url += `&sequence=${encodeURIComponent(sequence)}`;
        }
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (response.ok) {
            currentCRISPRResults = data;
            displayCRISPRResults(data);
        } else {
            resultsDiv.innerHTML = `<p class="error">❌ ${data.detail || 'Error running CRISPR analysis'}</p>`;
        }
    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
    }
}

function displayCRISPRResults(data) {
    const resultsDiv = document.getElementById('crispr-results');
    
    let html = `
        <div class="stats-summary">
            <div class="stat-item">
                <span class="stat-value">${data.sequence_length}</span>
                <span class="stat-label">Sequence Length (bp)</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${data.total_pam_sites}</span>
                <span class="stat-label">Total PAM Sites</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${(data.gc_content * 100).toFixed(1)}%</span>
                <span class="stat-label">GC Content</span>
            </div>
        </div>
        
        <h4>PAM Sites by Type</h4>
        <ul>
    `;
    
    for (const [type, count] of Object.entries(data.pam_sites_by_type)) {
        html += `<li>${type}: ${count} sites</li>`;
    }
    
    html += `</ul><h3>Top PAM Sites</h3>`;
    
    if (data.pam_sites && data.pam_sites.length > 0) {
        data.pam_sites.slice(0, 10).forEach(pam => {
            html += `
                <div class="pam-site-card">
                    <div class="pam-header">
                        <span class="pam-type">${pam.pam_type}</span>
                        <span class="pam-position">Position: ${pam.position}</span>
                        <span class="pam-strand">Strand: ${pam.strand}</span>
                    </div>
                    <div class="pam-sequence">
                        <p><strong>PAM:</strong> ${pam.pam_sequence}</p>
                        <p><strong>Spacer:</strong> ${pam.spacer_sequence}</p>
                    </div>
                </div>
            `;
        });
        
        if (data.pam_sites.length > 10) {
            html += `<p style="text-align: center; color: #666;">Showing 10 of ${data.pam_sites.length} PAM sites</p>`;
        }
    } else {
        html += '<p>No PAM sites found</p>';
    }
    
    resultsDiv.innerHTML = html;
}

async function exportCRISPR(format) {
    const source = document.getElementById('crispr-source').value;
    
    let url = `/api/analysis/crispr/export?format_type=${format}`;
    let options = { method: 'POST' };
    
    if (source === 'file') {
        const fileInput = document.getElementById('crispr-fasta-file');
        if (!fileInput.files[0]) {
            alert('Please select a FASTA file first');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        options.body = formData;
    } else {
        const sequence = document.getElementById('crispr-sequence').value;
        if (!sequence) {
            alert('Please enter a sequence first');
            return;
        }
        
        url += `&sequence=${encodeURIComponent(sequence)}`;
    }
    
    const response = await fetch(url, options);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `crispr_results.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

const style = document.createElement('style');
style.textContent = `
    .description { color: #666; margin-bottom: 1rem; }
    .results-section { margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; }
    .loading { color: #666; text-align: center; padding: 2rem; }
    .error { color: #dc3545; }
    .stats-summary { display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .stat-item { text-align: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; min-width: 120px; }
    .stat-item .stat-value { font-size: 2rem; font-weight: bold; display: block; }
    .stat-item .stat-label { font-size: 0.9rem; opacity: 0.9; }
    .cluster-card { background: white; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
    .cluster-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .cluster-id { font-weight: bold; color: #667eea; }
    .cluster-size { background: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .pam-site-card { background: white; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid #28a745; }
    .pam-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .pam-type { background: #28a745; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .pam-position, .pam-strand { color: #666; font-size: 0.9rem; }
    .pam-sequence { font-family: monospace; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; }
`;
document.head.appendChild(style);
