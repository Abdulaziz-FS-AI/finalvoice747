const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && 
    supabaseUrl !== 'your_supabase_url_here' && 
    supabaseAnonKey && 
    supabaseAnonKey !== 'your_anon_key_here';

// Public client for user operations (null if not configured)
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Service client for admin operations (webhooks, cleanup)
const supabaseAdmin = isSupabaseConfigured ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Get user from JWT token
async function getUserFromToken(token) {
    if (!supabase) {
        console.warn('Supabase not configured - skipping auth');
        return null;
    }
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Error verifying token:', error.message);
        return null;
    }
}

// Get user ID from request headers
async function getUserIdFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);
    return user?.id || null;
}

// Check if user is authenticated
async function isAuthenticated(req) {
    const userId = await getUserIdFromRequest(req);
    return !!userId;
}

// Get user's demo status
async function getUserDemoStatus(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('demo_expires_at, is_demo_user')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        return {
            isDemo: data.is_demo_user,
            expiresAt: data.demo_expires_at,
            isExpired: new Date(data.demo_expires_at) < new Date()
        };
    } catch (error) {
        console.error('Error getting demo status:', error.message);
        return null;
    }
}

// Cleanup expired demo users (to be called by cron job)
async function cleanupExpiredDemos() {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('cleanup_demo_users_with_call_limits');
            
        if (error) throw error;
        
        console.log(`Cleaned up ${data} expired demo users`);
        return data;
    } catch (error) {
        console.error('Error cleaning up demos:', error.message);
        return 0;
    }
}

module.exports = {
    supabase,
    supabaseAdmin,
    getUserFromToken,
    getUserIdFromRequest,
    isAuthenticated,
    getUserDemoStatus,
    cleanupExpiredDemos
};