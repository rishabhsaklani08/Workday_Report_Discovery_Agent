document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const resultsList = document.getElementById('results-list');

    // Sidebar Elements
    const catalogCountEl = document.getElementById('catalog-count');
    const llmStatusEl = document.getElementById('llm-status');
    const syncBtn = document.getElementById('sync-btn');
    const toast = document.getElementById('toast');

    // Settings
    const llmSlider = document.getElementById('llm-top-k');
    const llmVal = document.getElementById('llm-val');
    const useLlmToggle = document.getElementById('use-llm');

    // Initialize Settings Labels
    llmSlider.addEventListener('input', (e) => llmVal.textContent = e.target.value);

    // Initial Load: Get Stats
    fetchStats();

    // Event Listeners
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    syncBtn.addEventListener('click', handleSync);

    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            catalogCountEl.textContent = data.num_reports.toLocaleString();

            if (data.llm_enabled) {
                llmStatusEl.textContent = 'Active';
                llmStatusEl.classList.remove('offline');
            } else {
                llmStatusEl.textContent = 'Offline (Base Only)';
                llmStatusEl.classList.add('offline');
                useLlmToggle.checked = false;
                useLlmToggle.disabled = true;
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
            showToast("Failed to connect to backend", "error");
        }
    }

    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        // Update UI State
        emptyState.classList.add('hidden');
        resultsList.innerHTML = '';
        loadingState.classList.remove('hidden');

        const requestBody = {
            query: query,
            bm25_top_n: 50, // Fixed size to retrieve the best candidate pool for the LLM
            llm_top_k: parseInt(llmSlider.value),
            use_llm: useLlmToggle.checked
        };

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) throw new Error("Search failed");

            const data = await res.json();
            renderResults(data.results);
        } catch (error) {
            console.error("Search Error:", error);
            showToast("Search failed to execute.", "error");
            emptyState.classList.remove('hidden');
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    function renderResults(results) {
        if (!results || results.length === 0) {
            resultsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🤷</div>
                    <h2>No results found</h2>
                    <p>Try adjusting your query or settings.</p>
                </div>
            `;
            return;
        }

        resultsList.innerHTML = results.map((result, index) => {
            const report = result.report || {};
            const scoreStr = typeof result.score === 'number' ? result.score.toFixed(1) : result.score;

            return `
                <div class="result-card band-${result.band}" style="animation: slideUp 0.3s ease ${index * 0.05}s both;">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${result.report_name}</div>
                        </div>
                        <div class="score-badge">
                            <span class="score-value">${scoreStr}</span>
                            <span class="score-label">${result.band}</span>
                        </div>
                    </div>
                    
                    ${result.explanation ? `<div class="card-explanation"><strong>Why:</strong> ${result.explanation}</div>` : ''}
                    
                    <details class="card-details">
                        <summary>View Details</summary>
                        <div class="details-content">
                            <div class="meta-item"><strong>Report Name:</strong> <span>${result.report_name || 'N/A'}</span></div>
                            <div class="meta-item"><strong>Report Type:</strong> <span>${report.Report_Type || 'N/A'}</span></div>
                            <div class="meta-item"><strong>Description:</strong> <span>${report.Brief_Description || 'N/A'}</span></div>
                            <div class="meta-item"><strong>Data Source:</strong> <span>${report.DS_Description || 'N/A'}</span></div>
                            <div class="meta-item"><strong>Fields Displayed:</strong> <span>${report.Fields_Displayed_on_Report || 'N/A'}</span></div>
                            <div class="meta-item"><strong>Fields Referenced:</strong> <span>${report.Fields_Referenced_in_Report || 'N/A'}</span></div>
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    }

    async function handleSync() {
        const originalText = syncBtn.innerHTML;
        syncBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 8px 0 0;"></div> Syncing...';
        syncBtn.disabled = true;

        try {
            const res = await fetch('/api/sync', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                showToast(data.message, "success");
                fetchStats(); // Update count
            } else {
                throw new Error(data.detail || "Sync failed");
            }
        } catch (error) {
            console.error("Sync error:", error);
            showToast(error.message, "error");
        } finally {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
    }

    function showToast(message, type = "success") {
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.classList.add('hidden');
                toast.style.transform = '';
                toast.style.opacity = '';
            }, 300);
        }, 3000);
    }
});

// Add keyframe animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);
