let currentPage = 0;
const pageSize = 20;
let expandedSequences = new Set();

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

async function checkJob() {
    const jobId = document.getElementById('job-id').value || getQueryParam('job_id');
    
    if (!jobId) {
        alert('Please enter a Job ID');
        return;
    }
    
    try {
        const response = await fetch(`/api/alignment/job/${jobId}`);
        const job = await response.json();
        
        if (response.ok) {
            document.getElementById('job-result-section').style.display = 'block';
            
            let statusClass = '';
            if (job.status === 'completed') statusClass = 'success';
            else if (job.status === 'failed') statusClass = 'error';
            
            let jobHtml = `
                <p><strong>Job ID:</strong> ${job.id}</p>
                <p><strong>Status:</strong> <span class="${statusClass}">${job.status}</span></p>
                <p><strong>Created:</strong> ${new Date(job.created_at).toLocaleString()}</p>
            `;
            
            if (job.completed_at) {
                jobHtml += `<p><strong>Completed:</strong> ${new Date(job.completed_at).toLocaleString()}</p>`;
            }
            
            if (job.query_length) {
                jobHtml += `<p><strong>Query length:</strong> ${job.query_length} bp</p>`;
            }
            
            document.getElementById('job-info').innerHTML = jobHtml;
            document.getElementById('job-info').className = `result-box ${statusClass}`;
            
            if (job.results && job.results.length > 0) {
                renderAlignmentResults(job.results);
            } else if (job.status === 'completed') {
                document.getElementById('alignment-results').innerHTML = '<p>No significant alignments found</p>';
            } else {
                document.getElementById('alignment-results').innerHTML = '';
            }
        } else {
            alert('Job not found');
        }
    } catch (error) {
        console.error('Error checking job:', error);
        alert('Error checking job status');
    }
}

function renderAlignmentResults(results) {
    const container = document.getElementById('alignment-results');
    let html = '';
    
    const displayResults = results.slice(0, 50);
    const hasMore = results.length > 50;
    
    displayResults.forEach((hit, idx) => {
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
                    <div class="sequence-truncated" data-full-query="${encodeURIComponent(hit.aligned_query)}" data-full-subject="${encodeURIComponent(hit.aligned_subject)}">
                        <span class="short-sequence">
                            ${hit.aligned_query.substring(0, 80)}...<br>
                            ${hit.aligned_subject.substring(0, 80)}...
                        </span>
                        <button class="expand-btn" onclick="toggleSequence(this)">展开</button>
                    </div>
                    <div class="alignment-position">Subject: ${hit.subject_start} - ${hit.subject_end}</div>
                </div>
            </div>
        `;
    });
    
    if (hasMore) {
        html += `<p style="text-align: center; color: #718096; margin-top: 1rem;">显示前50条结果，共${results.length}条</p>`;
    }
    
    container.innerHTML = html;
}

function toggleSequence(button) {
    const container = button.parentElement;
    const shortSeq = container.querySelector('.short-sequence');
    const fullQuery = decodeURIComponent(container.dataset.fullQuery);
    const fullSubject = decodeURIComponent(container.dataset.fullSubject);
    
    if (button.textContent === '展开') {
        shortSeq.innerHTML = `${fullQuery}<br>${fullSubject}`;
        button.textContent = '收起';
    } else {
        shortSeq.innerHTML = `
            ${fullQuery.substring(0, 80)}...<br>
            ${fullSubject.substring(0, 80)}...
        `;
        button.textContent = '展开';
    }
}

async function loadSequences(page = 0) {
    currentPage = page;
    const skip = page * pageSize;
    
    try {
        const response = await fetch(`/api/sequences/?skip=${skip}&limit=${pageSize}`);
        const data = await response.json();
        
        const container = document.getElementById('sequences-list');
        const sequences = data.sequences;
        
        if (sequences.length === 0) {
            container.innerHTML = '<p>No sequences in database</p>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }
        
        let html = '';
        sequences.forEach(seq => {
            const isExpanded = expandedSequences.has(seq.seq_id);
            const displaySequence = isExpanded ? seq.sequence : seq.sequence.substring(0, 150);
            const showExpandButton = seq.sequence.length > 150;
            
            html += `
                <div class="sequence-item">
                    <div class="sequence-header">
                        <span class="sequence-id">${seq.seq_id}</span>
                        <span class="sequence-meta">${seq.seq_type} • ${seq.length} bp</span>
                    </div>
                    <p style="font-size: 0.9rem; color: #718096; margin-bottom: 0.5rem;">${seq.header}</p>
                    <div class="sequence-display">
                        <p class="sequence-text" id="seq-${seq.seq_id.replace(/[^a-zA-Z0-9]/g, '_')}" 
                           style="font-family: monospace; font-size: 0.8rem; color: #a0aec0; word-break: break-all;">
                            ${displaySequence}${!isExpanded && showExpandButton ? '...' : ''}
                        </p>
                        ${showExpandButton ? `
                            <button class="expand-btn" onclick="toggleSequenceDisplay('${seq.seq_id}', '${encodeURIComponent(seq.sequence)}')">
                                ${isExpanded ? '收起' : '展开'}
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        renderPagination(data.total, data.skip, data.limit, data.has_more);
    } catch (error) {
        console.error('Error loading sequences:', error);
        document.getElementById('sequences-list').innerHTML = '<p class="error">Error loading sequences</p>';
    }
}

function toggleSequenceDisplay(seqId, fullSequence) {
    const elementId = 'seq-' + seqId.replace(/[^a-zA-Z0-9]/g, '_');
    const element = document.getElementById(elementId);
    const button = element.parentElement.querySelector('.expand-btn');
    
    if (expandedSequences.has(seqId)) {
        expandedSequences.delete(seqId);
        element.textContent = decodeURIComponent(fullSequence).substring(0, 150) + '...';
        button.textContent = '展开';
    } else {
        expandedSequences.add(seqId);
        element.textContent = decodeURIComponent(fullSequence);
        button.textContent = '收起';
    }
}

function renderPagination(total, skip, limit, hasMore) {
    const currentPageNum = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    
    let paginationHtml = `<div class="pagination">`;
    
    if (currentPageNum > 1) {
        paginationHtml += `<button class="page-btn" onclick="loadSequences(${currentPage - 1})">上一页</button>`;
    }
    
    paginationHtml += `<span class="page-info">第 ${currentPageNum} / ${totalPages} 页 (共 ${total} 条)</span>`;
    
    if (hasMore) {
        paginationHtml += `<button class="page-btn" onclick="loadSequences(${currentPage + 1})">下一页</button>`;
    }
    
    paginationHtml += `</div>`;
    
    document.getElementById('pagination').innerHTML = paginationHtml;
    const bottomPagination = document.getElementById('pagination-bottom');
    if (bottomPagination) {
        bottomPagination.innerHTML = paginationHtml;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const jobId = getQueryParam('job_id');
    if (jobId) {
        document.getElementById('job-id').value = jobId;
        checkJob();
    }
    
    loadSequences(0);
});
