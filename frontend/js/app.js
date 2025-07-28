// Global configuration - Updated for Docker environment
const API_BASE = window.location.origin; // Use same origin for Docker setup

// Utility functions
function isValidUrl(string) {
    if (!string || typeof string !== 'string') return false;
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Notification system
function showNotification(message, type = 'success', duration = 5000) {
    let notification = document.getElementById('notification');
    
    // Create notification element if it doesn't exist
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide notification
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Loading state management
function showLoading(elementId, isLoading) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (isLoading) {
        element.disabled = true;
        if (!element.dataset.originalText) {
            element.dataset.originalText = element.textContent;
        }
        element.textContent = 'Loading...';
        element.style.opacity = '0.7';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || element.textContent;
        element.style.opacity = '1';
    }
}

// Enhanced API request helper with better error handling
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies in Docker
    };

    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    try {
        console.log(`Making API request to: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { message: await response.text() };
        }

        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API request failed:', error);
        
        // Handle network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your connection and try again.');
        }
        
        throw error;
    }
}

// Authentication helpers
function redirectToLogin() {
    window.location.href = '/login.html';
}

function redirectToDashboard() {
    window.location.href = '/dashboard.html';
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    // Add notification styles if not present
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                max-width: 400px;
                word-wrap: break-word;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification.success {
                background-color: #10b981;
            }
            
            .notification.error {
                background-color: #ef4444;
            }
            
            .notification.warning {
                background-color: #f59e0b;
            }
            
            @media (max-width: 640px) {
                .notification {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                    transform: translateY(-100px);
                }
                
                .notification.show {
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(styles);
    }
});

// Copy to clipboard utility
async function copyToClipboard(text) {
    if (!text) {
        showNotification('Nothing to copy', 'error');
        return false;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers or non-HTTPS
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'absolute';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        showNotification('Copied to clipboard!', 'success');
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showNotification('Failed to copy to clipboard', 'error');
        return false;
    }
}

// URL validation
function validateUrl(url) {
    if (!url || url.trim() === '') {
        return 'URL is required';
    }
    
    const trimmedUrl = url.trim();
    
    if (!isValidUrl(trimmedUrl)) {
        return 'Please enter a valid URL';
    }
    
    try {
        const urlObj = new URL(trimmedUrl);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return 'URL must use HTTP or HTTPS protocol';
        }
    } catch (error) {
        return 'Please enter a valid URL';
    }
    
    return null;
}

// Form validation
function validateForm(formElement) {
    const errors = [];
    const inputs = formElement.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        const value = input.value.trim();
        
        if (!value) {
            const fieldName = input.name || input.id || 'Field';
            errors.push(`${fieldName} is required`);
            return;
        }
        
        // URL validation
        if (input.type === 'url') {
            const urlError = validateUrl(value);
            if (urlError) {
                errors.push(urlError);
            }
        }
        
        // Email validation
        if (input.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errors.push('Please enter a valid email address');
            }
        }
        
        // Password validation
        if (input.type === 'password' && input.name === 'password') {
            if (value.length < 6) {
                errors.push('Password must be at least 6 characters long');
            }
            if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                errors.push('Password must contain uppercase, lowercase, and number');
            }
        }
        
        // Username validation
        if (input.name === 'username') {
            if (value.length < 3) {
                errors.push('Username must be at least 3 characters long');
            }
            if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                errors.push('Username can only contain letters, numbers, and underscores');
            }
        }
    });
    
    return errors;
}

// Enhanced error handling
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = 'An unexpected error occurred';
    
    if (error.message) {
        if (error.message.includes('Network error')) {
            message = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            message = 'Session expired. Please login again.';
            setTimeout(() => redirectToLogin(), 2000);
        } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
            message = 'Too many requests. Please try again later.';
        } else if (error.message.includes('404')) {
            message = 'Resource not found.';
        } else if (error.message.includes('400')) {
            message = error.message; // Show validation errors as-is
        } else {
            message = error.message;
        }
    }
    
    showNotification(message, 'error');
}

// Local storage helpers (fallback for when cookies aren't available)
function setLocalData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('LocalStorage not available:', error);
    }
}

function getLocalData(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.warn('LocalStorage not available:', error);
        return null;
    }
}

function removeLocalData(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('LocalStorage not available:', error);
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle utility
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export functions for use in other scripts
window.AppUtils = {
    isValidUrl,
    formatDate,
    formatNumber,
    showNotification,
    showLoading,
    apiRequest,
    redirectToLogin,
    redirectToDashboard,
    copyToClipboard,
    validateUrl,
    validateForm,
    handleError,
    setLocalData,
    getLocalData,
    removeLocalData,
    debounce,
    throttle,
    // Legacy support: checks if user is in localStorage
    isAuthenticated: function() {
        return !!window.localStorage.getItem('user');
    }
};