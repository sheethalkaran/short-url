// Authentication handling
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    
    // Validate form
    const errors = AppUtils.validateForm(form);
    if (errors.length > 0) {
        AppUtils.showNotification(errors[0], 'error');
        return;
    }
    
    try {
        AppUtils.showLoading('loginBtn', true);
        
        const response = await AppUtils.apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success) {
            AppUtils.showNotification('Login successful!', 'success');
            
            // Store user data locally for quick access
            AppUtils.setLocalData('user', response.user);
            
            // Redirect to dashboard
            setTimeout(() => {
                AppUtils.redirectToDashboard();
            }, 1000);
        }
    } catch (error) {
        AppUtils.handleError(error, 'login');
    } finally {
        AppUtils.showLoading('loginBtn', false);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    
    // Validate form
    const errors = AppUtils.validateForm(form);
    if (errors.length > 0) {
        AppUtils.showNotification(errors[0], 'error');
        return;
    }
    
    try {
        AppUtils.showLoading('registerBtn', true);
        
        const response = await AppUtils.apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        if (response.success) {
            AppUtils.showNotification('Account created successfully!', 'success');
            
            // Store user data locally
            AppUtils.setLocalData('user', response.user);
            
            // Redirect to dashboard
            setTimeout(() => {
                AppUtils.redirectToDashboard();
            }, 1000);
        }
    } catch (error) {
        AppUtils.handleError(error, 'register');
    } finally {
        AppUtils.showLoading('registerBtn', false);
    }
}

async function handleLogout() {
    try {
        const response = await AppUtils.apiRequest('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.success) {
            // Clear local data
            AppUtils.removeLocalData('user');
            
            AppUtils.showNotification('Logged out successfully', 'success');
            
            // Redirect to home page
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
        }
    } catch (error) {
        // Even if logout fails on server, clear local data and redirect
        AppUtils.removeLocalData('user');
        window.location.href = '/index.html';
    }
}

// Auto-login check
async function checkAutoLogin() {
    // Relying on backend profile endpoint for authentication check
    
    try {
        const response = await AppUtils.apiRequest('/api/auth/profile');
        
        if (response.success) {
            AppUtils.setLocalData('user', response.user);
            return true;
        }
    } catch (error) {
        console.log('Auto-login failed:', error);
        AppUtils.removeLocalData('user');
    }
    
    return false;
}

// Initialize authentication
document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname;
    
    // If on login page and already authenticated, redirect to dashboard
    if (currentPage.includes('/login.html')) {
        const isLoggedIn = await checkAutoLogin();
        if (isLoggedIn) {
            AppUtils.redirectToDashboard();
        }
    }
    
    // Set button IDs for loading states
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    const registerBtn = document.querySelector('#registerForm button[type="submit"]');
    
    if (loginBtn) loginBtn.id = 'loginBtn';
    if (registerBtn) registerBtn.id = 'registerBtn';
});