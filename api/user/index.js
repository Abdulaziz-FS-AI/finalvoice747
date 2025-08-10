const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const UserLimitsService = require('../../services/user-limits.service');
const { supabase } = require('../../services/supabase.service');

// Initialize service
const userLimitsService = new UserLimitsService(supabase);

// GET /api/user/limits - Get user usage limits and current usage
router.get('/limits', requireAuth, async (req, res) => {
    try {
        console.log(`🔍 Getting user limits for: ${req.userId}`);
        
        const limits = await userLimitsService.getUserLimits(req.userId);
        
        if (!limits.success) {
            console.error('Failed to get user limits:', limits.error);
            return res.status(500).json(limits);
        }
        
        console.log('✅ User limits retrieved:', {
            assistantCount: limits.data.current_assistants,
            maxAssistants: limits.data.max_assistants,
            callTimeUsed: limits.data.used_call_time_seconds,
            maxCallTime: limits.data.max_call_time_seconds
        });
        
        // Get usage warnings
        const warnings = userLimitsService.getUsageWarnings(limits.data);
        
        res.json({
            success: true,
            data: limits.data,
            warnings: warnings
        });
    } catch (error) {
        console.error('Error getting user limits:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user limits'
        });
    }
});

// GET /api/user/usage-history - Get user usage history
router.get('/usage-history', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        console.log(`🔍 Getting usage history for user: ${req.userId}, limit: ${limit}`);
        
        const history = await userLimitsService.getUserUsageHistory(req.userId, limit);
        
        if (!history.success) {
            console.error('Failed to get usage history:', history.error);
            return res.status(500).json(history);
        }
        
        console.log(`✅ Usage history retrieved: ${history.data.length} entries`);
        
        res.json(history);
    } catch (error) {
        console.error('Error getting usage history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get usage history'
        });
    }
});

// GET /api/user/demo-time - Get remaining demo time
router.get('/demo-time', requireAuth, async (req, res) => {
    try {
        const demoTime = await userLimitsService.getDemoTimeRemaining(req.userId);
        
        res.json({
            success: true,
            data: demoTime
        });
    } catch (error) {
        console.error('Error getting demo time:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get demo time'
        });
    }
});

module.exports = router;