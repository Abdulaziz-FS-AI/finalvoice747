// auth-helper.js - Enhanced auth utilities for all pages

let supabaseClient = null;
let isInitializing = false;

// Initialize Supabase from backend config with retry logic
async function initializeAuth() {
    if (isInitializing) {
        // Wait for existing initialization to complete
        while (isInitializing && !supabaseClient) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return supabaseClient;
    }
    
    if (supabaseClient) {
        return supabaseClient;
    }
    
    isInitializing = true;
    
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
        
        if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            console.log('✅ Supabase client created successfully');
        } else {
            throw new Error('Supabase library not loaded');
        }
        
        return supabaseClient;
    } catch (error) {
        console.error('❌ Auth initialization error:', error);
        throw new Error(`Authentication setup failed: ${error.message}`);
    } finally {
        isInitializing = false;
    }
}

// Check if user is authenticated with session fallback
async function checkAuth() {
    try {
        if (!supabaseClient) {
            console.log('🔄 Supabase client not initialized, initializing...');
            await initializeAuth();
        }
        
        console.log('👤 Checking user authentication status...');
        
        // Try getUser first
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError) {
            console.warn('⚠️ getUser error, trying session fallback:', userError);
        }
        
        if (user) {
            console.log('✅ User authenticated via getUser:', user.email);
            return user;
        }
        
        // Fallback to session check
        console.log('🔄 Trying session fallback...');
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Session check error:', sessionError);
            throw new Error(`Authentication check failed: ${sessionError.message}`);
        }
        
        if (session && session.user) {
            console.log('✅ User authenticated via session:', session.user.email);
            return session.user;
        }
        
        console.log('❌ No authenticated user found');
        return null;
        
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
            // Immediate redirect without delay to prevent UI flashing
            window.location.href = '/auth';
            return null;
        }
        
        console.log('✅ Authentication requirement satisfied');
        return user;
    } catch (error) {
        console.error('❌ requireAuth failed:', error);
        // On error, still redirect to auth but with error info
        console.log('🔀 Redirecting to auth due to error...');
        window.location.href = '/auth?error=' + encodeURIComponent(error.message);
        return null;
    }
}

// Get auth token for API calls with retry
async function getAuthToken() {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token || null;
}

// Make authenticated API call with automatic retry
async function authenticatedFetch(url, options = {}) {
    const token = await getAuthToken();
    if (!token) {
        console.error('❌ No authentication token available');
        window.location.href = '/auth';
        return null;
    }
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
}

// Simple authenticated fetch for create-assistant page
async function authenticatedFetchSimple(url, options = {}) {
    try {
        if (!supabaseClient) {
            await initializeAuth();
        }
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            console.error('❌ No session available');
            window.location.href = '/auth';
            return null;
        }
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            console.error('❌ Authentication expired');
            window.location.href = '/auth';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('❌ authenticatedFetchSimple error:', error);
        return null;
    }
}

// Sign out with cleanup
async function signOut() {
    try {
        if (!supabaseClient) {
            await initializeAuth();
        }
        
        console.log('🚪 Signing out...');
        await supabaseClient.auth.signOut();
        
        // Clear any stored auth data
        sessionStorage.clear();
        localStorage.removeItem('supabase.auth.token');
        
        window.location.href = '/auth';
    } catch (error) {
        console.error('❌ Sign out error:', error);
        // Force redirect even if sign out fails
        window.location.href = '/auth';
    }
}

// Listen for auth state changes
async function onAuthStateChange(callback) {
    if (!supabaseClient) {
        await initializeAuth();
    }
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('🔄 Auth state change:', event);
        callback(event, session);
    });
}

// Export for global access
if (typeof window !== 'undefined') {
    window.initializeAuth = initializeAuth;
    window.checkAuth = checkAuth;
    window.requireAuth = requireAuth;
    window.authenticatedFetch = authenticatedFetch;
    window.authenticatedFetchSimple = authenticatedFetchSimple;
    window.signOut = signOut;
    window.onAuthStateChange = onAuthStateChange;
}