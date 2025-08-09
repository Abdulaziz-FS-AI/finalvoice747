// auth-helper.js - Shared auth utilities for all pages

let supabaseClient = null;

// Initialize Supabase from backend config
async function initializeAuth() {
    try {
        const response = await fetch('/api/config/auth');
        if (!response.ok) throw new Error('Failed to load auth config');
        
        const config = await response.json();
        const { createClient } = supabase;
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
        
        return supabaseClient;
    } catch (error) {
        console.error('Auth initialization error:', error);
        throw error;
    }
}

// Check if user is authenticated
async function checkAuth() {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// Require authentication or redirect to login
async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/auth.html';
        return null;
    }
    return user;
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
    window.location.href = '/auth.html';
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