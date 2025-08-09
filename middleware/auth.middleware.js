const { getUserIdFromRequest, getUserDemoStatus } = require('../services/supabase.service');

// Require authentication for routes
async function requireAuth(req, res, next) {
    try {
        const userId = await getUserIdFromRequest(req);
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // Check if demo expired
        const demoStatus = await getUserDemoStatus(userId);
        if (demoStatus?.isExpired) {
            // Silent failure - just act like auth failed
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // Add user ID to request for use in routes
        req.userId = userId;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
}

// Optional auth - adds userId if authenticated but doesn't require it
async function optionalAuth(req, res, next) {
    try {
        const userId = await getUserIdFromRequest(req);
        req.userId = userId;
        next();
    } catch (error) {
        // Continue without auth
        req.userId = null;
        next();
    }
}

module.exports = {
    requireAuth,
    optionalAuth
};