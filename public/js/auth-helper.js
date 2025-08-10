// auth-helper.js - Shared auth utilities for all pages

let supabaseClient = null;

// Initialize Supabase from backend config
async function initializeAuth() {
    try {
        console.log('🔧 Initializing authentication...');
        const response = await fetch('/api/config/auth');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Auth config request failed:', response.status, errorText);
            throw new Error(`Failed to load auth config (${response.status}): ${errorText}`);
        }
        
        const config = await response.json();
        console.log('🔐 Auth config loaded successfully');
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.error('❌ Invalid auth config:', config);
            throw new Error('Invalid authentication configuration');
        }
        
        const { createClient } = supabase;
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
        console.log('✅ Supabase client created successfully');
        
        return supabaseClient;
    } catch (error) {
        console.error('❌ Auth initialization error:', error);
        throw new Error(`Authentication setup failed: ${error.message}`);
    }
}

// Check if user is authenticated
async function checkAuth() {
    try {
        if (!supabaseClient) {
            console.log('🔄 Supabase client not initialized, initializing...');
            await initializeAuth();
        }
        
        console.log('👤 Checking user authentication status...');
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.error('❌ Auth check error:', error);
            throw new Error(`Authentication check failed: ${error.message}`);
        }
        
        if (user) {
            console.log('✅ User is authenticated:', user.email);
        } else {
            console.log('❌ No authenticated user found');
        }
        
        return user;
    } catch (error) {
        console.error('❌ checkAuth failed:', error);
        throw error;
    }
}

// Require authentication or redirect to login
async function requireAuth() {
    try {
        console.log('🛡️ Requiring authentication...');
        const user = await checkAuth();
        
        if (!user) {
            console.log('🔀 Redirecting to auth page...');
            // Add a small delay to prevent immediate redirect loops
            setTimeout(() => {
                window.location.href = '/auth';
            }, 100);
            return null;
        }
        
        console.log('✅ Authentication requirement satisfied');
        return user;
    } catch (error) {
        console.error('❌ requireAuth failed:', error);
        // On error, still redirect to auth but with error info
        console.log('🔀 Redirecting to auth due to error...');
        setTimeout(() => {
            window.location.href = '/auth?error=' + encodeURIComponent(error.message);
        }, 100);
        return null;
    }
}

// Get auth token for API calls
async function getAuthToken() {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token || null;
}

// Make authenticated API call
async function authenticatedFetch(url, options = {}) {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('No authentication token');
    }
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    });
}

// Sign out
async function signOut() {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
}

// Listen for auth state changes
async function onAuthStateChange(callback) {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}