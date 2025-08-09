const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const analyticsService = require('../../services/analytics.service');

// Get analytics dashboard data
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get dashboard data from analytics service
        const dashboardData = await analyticsService.getDashboardData(userId);
        
        res.json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics data'
        });
    }
});

// Export call history as CSV
router.get('/export/calls', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get all call history
        const calls = await analyticsService.getCallHistory(userId, 1000); // Get up to 1000 calls
        
        // Convert to CSV
        const csvHeaders = 'Date,Time,Duration,Status,From,To,Summary\n';
        const csvRows = calls.map(call => {
            const date = new Date(call.startedAt);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                call.duration,
                call.statusDisplay,
                call.fromNumber,
                call.toNumber,
                `"${(call.summary || '').replace(/"/g, '""')}"` // Escape quotes in summary
            ].join(',');
        }).join('\n');
        
        const csv = csvHeaders + csvRows;
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="call-history.csv"');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting calls:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export call history'
        });
    }
});

// Get call details
router.get('/calls/:callId', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { callId } = req.params;
        
        // Get call details (with auth check)
        const { data: call, error } = await require('../../services/supabase.service').supabaseAdmin
            .from('call_logs')
            .select('*')
            .eq('id', callId)
            .eq('user_id', userId)
            .single();
        
        if (error || !call) {
            return res.status(404).json({
                success: false,
                error: 'Call not found'
            });
        }
        
        res.json({
            success: true,
            data: call
        });
    } catch (error) {
        console.error('Error fetching call details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch call details'
        });
    }
});

module.exports = router;