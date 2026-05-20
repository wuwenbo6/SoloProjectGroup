async function loadStats() {
    try {
        const response = await fetch('/api/sequences/stats');
        const stats = await response.json();
        
        document.getElementById('num-sequences').textContent = stats.num_sequences || 0;
        document.getElementById('total-length').textContent = formatNumber(stats.total_length || 0);
        document.getElementById('avg-length').textContent = Math.round(stats.avg_length || 0);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '/index.html') {
        loadStats();
    }
});
