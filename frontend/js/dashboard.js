// Dashboard functionality
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    await loadUrls();
    
    // Set up form submission
    const form = document.querySelector('.url-form');
    if (form) {
        form.addEventListener('submit', handleCreateUrl);
    }
});

// Load user profile
async function loadUserProfile() {
    try {
        const response = await AppUtils.apiRequest('/api/auth/profile');
        
        if (response.success) {
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = response.user.username;
            }
            
            AppUtils.setLocalData('user', response.user);
        }
    } catch (error) {
        AppUtils.handleError(error, 'load profile');
        // If profile load fails, likely not authenticated
        AppUtils.redirectToLogin();
    }
}

// Create new URL
async function handleCreateUrl(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const longUrl = formData.get('longUrl').trim();
    const customCode = formData.get('customCode').trim();
    const expiresAt = formData.get('expiresAt');
    
    // Validate URL
    const urlError = AppUtils.validateUrl(longUrl);
    if (urlError) {
        AppUtils.showNotification(urlError, 'error');
        return;
    }
    
    // Validate custom code if provided
    if (customCode && !/^[a-zA-Z0-9_-]+$/.test(customCode)) {
        AppUtils.showNotification('Custom code can only contain letters, numbers, hyphens, and underscores', 'error');
        return;
    }
    
    if (customCode && customCode.length < 3) {
        AppUtils.showNotification('Custom code must be at least 3 characters long', 'error');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        const requestBody = { longUrl };
        if (customCode) requestBody.customCode = customCode;
        if (expiresAt) requestBody.expiresAt = expiresAt;
        
        const response = await AppUtils.apiRequest('/api/url/shorten', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        
        if (response.success) {
            AppUtils.showNotification('URL created successfully!', 'success');
            
            // Reset form
            form.reset();
            
            // Reload URLs list
            await loadUrls();
            
            // Show result
            showUrlCreated(response.data);
        }
    } catch (error) {
        AppUtils.handleError(error, 'create URL');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Short URL';
    }
}

// Show created URL result
function showUrlCreated(urlData) {
    const modal = document.getElementById('urlModal');
    const modalBody = modal.querySelector('.modal-body');
    
    modalBody.innerHTML = `
        <div class="url-created-result">
            <h4>Your URL is ready!</h4>
            <div class="created-url-box">
                <div class="url-display">
                    <input type="text" value="${urlData.shortUrl}" readonly class="short-url-input">
                    <button onclick="AppUtils.copyToClipboard('${urlData.shortUrl}')" class="btn btn-outline btn-small">
                        📋 Copy
                    </button>
                </div>
            </div>
            <div class="url-details">
                <p><strong>Original URL:</strong> ${urlData.longUrl}</p>
                <p><strong>Short Code:</strong> ${urlData.shortCode}</p>
                <p><strong>Created:</strong> ${AppUtils.formatDate(urlData.createdAt)}</p>
                ${urlData.expiresAt ? `<p><strong>Expires:</strong> ${AppUtils.formatDate(urlData.expiresAt)}</p>` : ''}
            </div>
        </div>
    `;
    
    showModal();
}

// Load URLs list
async function loadUrls(page = 1) {
    if (isLoading) return;
    
    isLoading = true;
    const container = document.getElementById('urlsContainer');
    
    if (page === 1) {
        container.innerHTML = '<div class="loading">Loading your URLs...</div>';
    }
    
    try {
        const response = await AppUtils.apiRequest(`/api/url/my-urls?page=${page}&limit=10`);
        
        if (response.success) {
            currentPage = page;
            totalPages = response.data.pagination.pages;
            
            renderUrls(response.data.urls);
            updatePagination(response.data.pagination);
        }
    } catch (error) {
        container.innerHTML = '<div class="error-state">Failed to load URLs. <button onclick="loadUrls()" class="btn btn-outline btn-small">Retry</button></div>';
        AppUtils.handleError(error, 'load URLs');
    } finally {
        isLoading = false;
    }
}

// Render URLs list
function renderUrls(urls) {
    const container = document.getElementById('urlsContainer');
    
    if (urls.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No URLs yet</h3>
                <p>Create your first short URL using the form above!</p>
            </div>
        `;
        return;
    }
    
    const urlsHtml = urls.map(url => `
        <div class="url-item">
            <div class="url-info">
                <div class="url-title">
                    ${url.customCode ? `Custom: ${url.customCode}` : 'Short URL'}
                </div>
                <div class="url-original" title="${url.longUrl}">
                    ${url.longUrl.length > 60 ? url.longUrl.substring(0, 60) + '...' : url.longUrl}
                </div>
                <div class="url-short">
                    <a href="${url.shortUrl}" target="_blank">${url.shortUrl}</a>
                </div>
                <div class="url-meta">
                    <span>Created: ${AppUtils.formatDate(url.createdAt)}</span>
                    <span class="stats-badge">
                        👆 ${AppUtils.formatNumber(url.totalClicks || url.clicks)} clicks
                    </span>
                    ${url.expiresAt ? `<span>Expires: ${AppUtils.formatDate(url.expiresAt)}</span>` : ''}
                </div>
            </div>
            <div class="url-actions">
                <button onclick="copyUrlToClipboard('${url.shortUrl}')" class="btn btn-outline btn-small" title="Copy URL">
                    📋
                </button>
                <button onclick="showUrlStats('${url.shortCode}')" class="btn btn-outline btn-small" title="View Stats">
                    📊
                </button>
                <button onclick="deleteUrl('${url.shortCode}')" class="btn btn-danger btn-small" title="Delete URL">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = urlsHtml;
}

// Update pagination
function updatePagination(pagination) {
    const paginationElement = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');
    
    if (pagination.pages <= 1) {
        paginationElement.style.display = 'none';
        return;
    }
    
    paginationElement.style.display = 'flex';
    
    prevBtn.disabled = !pagination.hasPrev;
    nextBtn.disabled = !pagination.hasNext;
    
    pageInfo.textContent = `Page ${pagination.current} of ${pagination.pages} (${pagination.total} URLs)`;
}

// Pagination handlers
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        loadUrls(newPage);
    }
}

// Copy URL to clipboard
async function copyUrlToClipboard(url) {
    await AppUtils.copyToClipboard(url);
}

// Show URL statistics
async function showUrlStats(shortCode) {
    try {
        const response = await AppUtils.apiRequest(`/api/url/stats/${shortCode}`);
        
        if (response.success) {
            const url = response.data;
            const modal = document.getElementById('urlModal');
            const modalBody = modal.querySelector('.modal-body');
            
            modalBody.innerHTML = `
                <div class="url-stats">
                    <h4>URL Statistics</h4>
                    
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${AppUtils.formatNumber(url.clicks)}</div>
                            <div class="stat-label">Total Clicks</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${AppUtils.formatDate(url.createdAt)}</div>
                            <div class="stat-label">Created</div>
                        </div>
                        ${url.expiresAt ? `
                            <div class="stat-item">
                                <div class="stat-value ${url.isExpired ? 'text-danger' : ''}">${AppUtils.formatDate(url.expiresAt)}</div>
                                <div class="stat-label">Expires</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="url-details">
                        <div class="detail-item">
                            <label>Short URL:</label>
                            <div class="url-display">
                                <input type="text" value="${url.shortUrl}" readonly class="short-url-input">
                                <button onclick="AppUtils.copyToClipboard('${url.shortUrl}')" class="btn btn-outline btn-small">
                                    📋 Copy
                                </button>
                            </div>
                        </div>
                        
                        <div class="detail-item">
                            <label>Original URL:</label>
                            <div class="original-url" title="${url.longUrl}">
                                <a href="${url.longUrl}" target="_blank" rel="noopener noreferrer">
                                    ${url.longUrl}
                                </a>
                            </div>
                        </div>
                        
                        <div class="detail-item">
                            <label>Short Code:</label>
                            <code>${url.shortCode}</code>
                        </div>
                    </div>
                    
                    ${url.isExpired ? '<div class="alert alert-warning">⚠️ This URL has expired</div>' : ''}
                </div>
            `;
            
            showModal();
        }
    } catch (error) {
        AppUtils.handleError(error, 'load URL stats');
    }
}

// Delete URL
async function deleteUrl(shortCode) {
    if (!confirm('Are you sure you want to delete this URL? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await AppUtils.apiRequest(`/api/url/${shortCode}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            AppUtils.showNotification('URL deleted successfully', 'success');
            await loadUrls(currentPage);
        }
    } catch (error) {
        AppUtils.handleError(error, 'delete URL');
    }
}

// Refresh URLs
async function refreshUrls() {
    await loadUrls(currentPage);
    AppUtils.showNotification('URLs refreshed', 'success');
}

// Modal functions
function showModal() {
    const modal = document.getElementById('urlModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(event) {
    if (!event || event.target === event.currentTarget || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('urlModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Keyboard navigation
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Add additional styles for dashboard
const additionalStyles = `
<style>
.url-created-result {
    text-align: center;
}

.url-created-result h4 {
    color: var(--accent-color);
    margin-bottom: 1.5rem;
}

.created-url-box {
    background: var(--background-alt);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-bottom: 1.5rem;
}

.url-display {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.url-display input {
    flex: 1;
}

.url-details {
    text-align: left;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.url-details p {
    margin-bottom: 0.5rem;
}

.url-stats h4 {
    margin-bottom: 1.5rem;
    color: var(--text-primary);
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}

.stat-item {
    text-align: center;
    padding: 1rem;
    background: var(--background-alt);
    border-radius: var(--border-radius);
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 0.25rem;
}

.stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.detail-item {
    margin-bottom: 1.5rem;
}

.detail-item label {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.original-url {
    word-break: break-all;
}

.original-url a {
    color: var(--primary-color);
    text-decoration: none;
}

.original-url a:hover {
    text-decoration: underline;
}

.alert {
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius);
    margin-top: 1rem;
}

.alert-warning {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
}

.empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
}

.empty-state h3 {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
}

.error-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
}

.text-danger {
    color: var(--danger-color) !important;
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr 1fr;
    }
    
    .url-display {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
`;

// Inject additional styles
document.head.insertAdjacentHTML('beforeend', additionalStyles);
