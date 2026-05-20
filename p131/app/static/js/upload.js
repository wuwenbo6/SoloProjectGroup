function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab-btn[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function uploadSequences() {
    const fileInput = document.getElementById('fasta-upload');
    const resultBox = document.getElementById('upload-result');
    
    if (!fileInput.files[0]) {
        resultBox.innerHTML = '<p class="error">Please select a FASTA file</p>';
        resultBox.className = 'result-box error';
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/sequences/upload-fasta', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            resultBox.innerHTML = `
                <p class="success">✅ Upload successful!</p>
                <p>Parsed: ${result.parsed_count} sequences</p>
                <p>Created: ${result.created_count} new sequences</p>
            `;
            resultBox.className = 'result-box success';
        } else {
            resultBox.innerHTML = `<p class="error">❌ Error: ${result.detail || 'Upload failed'}</p>`;
            resultBox.className = 'result-box error';
        }
    } catch (error) {
        resultBox.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
        resultBox.className = 'result-box error';
    }
}

function parseFastaContent(content) {
    const lines = content.trim().split('\n');
    let sequence = '';
    
    for (const line of lines) {
        if (!line.startsWith('>')) {
            sequence += line.trim();
        }
    }
    
    return sequence || content.trim();
}

async function submitAlignment() {
    const resultBox = document.getElementById('alignment-result');
    
    let sequence = '';
    const fileInput = document.getElementById('alignment-upload');
    const textInput = document.getElementById('sequence-input');
    
    if (document.getElementById('file-tab').classList.contains('active')) {
        if (!fileInput.files[0]) {
            resultBox.innerHTML = '<p class="error">Please select a FASTA file</p>';
            resultBox.className = 'result-box error';
            return;
        }
        
        const text = await fileInput.files[0].text();
        sequence = parseFastaContent(text);
    } else {
        sequence = parseFastaContent(textInput.value);
    }
    
    if (!sequence) {
        resultBox.innerHTML = '<p class="error">Please enter a valid sequence</p>';
        resultBox.className = 'result-box error';
        return;
    }
    
    const seqType = document.getElementById('seq-type').value;
    const evalue = parseFloat(document.getElementById('evalue').value);
    
    try {
        const response = await fetch('/api/alignment/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sequence: sequence,
                seq_type: seqType,
                evalue_threshold: evalue
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            resultBox.innerHTML = `
                <p class="success">✅ Alignment job submitted!</p>
                <p><strong>Job ID:</strong> <a href="/results?job_id=${result.job_id}" style="color: #667eea;">${result.job_id}</a></p>
                <p><strong>Task ID:</strong> ${result.task_id}</p>
                <p><a href="/results?job_id=${result.job_id}" style="color: #667eea;">View results →</a></p>
            `;
            resultBox.className = 'result-box success';
        } else {
            resultBox.innerHTML = `<p class="error">❌ Error: ${result.detail || 'Submission failed'}</p>`;
            resultBox.className = 'result-box error';
        }
    } catch (error) {
        resultBox.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
        resultBox.className = 'result-box error';
    }
}

async function syncAlignment() {
    const resultBox = document.getElementById('alignment-result');
    
    let sequence = '';
    const fileInput = document.getElementById('alignment-upload');
    const textInput = document.getElementById('sequence-input');
    
    if (document.getElementById('file-tab').classList.contains('active')) {
        if (!fileInput.files[0]) {
            resultBox.innerHTML = '<p class="error">Please select a FASTA file</p>';
            resultBox.className = 'result-box error';
            return;
        }
        
        const text = await fileInput.files[0].text();
        sequence = parseFastaContent(text);
    } else {
        sequence = parseFastaContent(textInput.value);
    }
    
    if (!sequence) {
        resultBox.innerHTML = '<p class="error">Please enter a valid sequence</p>';
        resultBox.className = 'result-box error';
        return;
    }
    
    const seqType = document.getElementById('seq-type').value;
    const evalue = parseFloat(document.getElementById('evalue').value);
    
    resultBox.innerHTML = '<p>⏳ Processing alignment...</p>';
    
    try {
        const response = await fetch('/api/alignment/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sequence: sequence,
                seq_type: seqType,
                evalue_threshold: evalue
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (result.results && result.results.length > 0) {
                let html = `
                    <p class="success">✅ Alignment complete!</p>
                    <p>Found ${result.results.length} alignments</p>
                    <p>Query length: ${result.query_length} bp</p>
                    <hr style="margin: 1rem 0;">
                `;
                
                result.results.forEach((hit, idx) => {
                    html += `
                        <div class="alignment-result">
                            <div class="alignment-header">
                                <div><strong>Hit ${idx + 1}:</strong> ${hit.seq_id}</div>
                                <div class="alignment-score">
                                    <span class="score-item">Score: ${hit.score.toFixed(1)}</span>
                                    <span class="score-item evalue">E-value: ${hit.evalue.toExponential(2)}</span>
                                    <span class="score-item identity">Identity: ${(hit.identity * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="alignment-sequence">
                                <div class="alignment-position">Query: ${hit.query_start} - ${hit.query_end}</div>
                                ${hit.aligned_query}<br>
                                ${hit.aligned_subject}<br>
                                <div class="alignment-position">Subject: ${hit.subject_start} - ${hit.subject_end}</div>
                            </div>
                        </div>
                    `;
                });
                
                resultBox.innerHTML = html;
                resultBox.className = 'result-box success';
            } else {
                resultBox.innerHTML = `
                    <p>⚠️ No significant alignments found</p>
                    <p>Query length: ${result.query_length} bp</p>
                    <p>Try increasing the E-value threshold for more results</p>
                `;
                resultBox.className = 'result-box';
            }
        } else {
            resultBox.innerHTML = `<p class="error">❌ Error: ${result.detail || 'Alignment failed'}</p>`;
            resultBox.className = 'result-box error';
        }
    } catch (error) {
        resultBox.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
        resultBox.className = 'result-box error';
    }
}
