const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const { supabase } = require('../../services/supabase.service');

// GET /api/call-logs - Get user's call logs
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, offset = 0, assistant_id } = req.query;
        
        // Build query
        let query = supabase
            .from('call_logs')
            .select(`
                *,
                assistants!inner (
                    id,
                    name,
                    user_id
                ),
                phone_numbers (
                    id,
                    phone_number,
                    friendly_name
                )
            `)
            .eq('assistants.user_id', userId)
            .order('started_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        // Filter by assistant if specified
        if (assistant_id) {
            query = query.eq('assistant_id', assistant_id);
        }
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error('Error fetching call logs:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch call logs'
            });
        }
        
        // Format response
        const formattedLogs = data.map(log => ({
            id: log.id,
            assistantId: log.assistant_id,
            assistantName: log.assistants.name,
            phoneNumber: log.phone_numbers?.phone_number || 'Unknown',
            phoneNumberName: log.phone_numbers?.friendly_name || 'Unknown',
            callerNumber: log.caller_number,
            duration: log.duration_seconds,
            durationFormatted: formatDuration(log.duration_seconds),
            status: log.status,
            transcript: log.transcript,
            summary: log.summary,
            structuredData: log.structured_data,
            successEvaluation: log.success_evaluation,
            startedAt: log.started_at,
            endedAt: log.ended_at
        }));
        
        res.json({
            success: true,
            data: formattedLogs,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: count
            }
        });
        
    } catch (error) {
        console.error('Error in call logs endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/call-logs/usage - Get user's call usage summary
router.get('/usage', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get usage summary
        const { data, error } = await supabase
            .rpc('get_user_call_usage', { user_uuid: userId });
            
        if (error) {
            console.error('Error fetching usage:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch usage data'
            });
        }
        
        const usage = data[0] || {
            total_call_seconds: 0,
            total_call_minutes: 0,
            call_count: 0,
            latest_call: null
        };
        
        // Check demo limits
        const { data: limits } = await supabase
            .rpc('check_user_assistant_limit', { user_uuid: userId });
            
        const demoInfo = limits[0] || {};
        
        res.json({
            success: true,
            data: {
                totalCallSeconds: usage.total_call_seconds,
                totalCallMinutes: usage.total_call_minutes,
                formattedDuration: formatDuration(usage.total_call_seconds),
                callCount: usage.call_count,
                latestCall: usage.latest_call,
                remainingMinutes: Math.max(0, 10 - usage.total_call_minutes),
                demoExpired: demoInfo.demo_expired || false,
                percentUsed: Math.min(100, (usage.total_call_minutes / 10) * 100)
            }
        });
        
    } catch (error) {
        console.error('Error in usage endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/call-logs/:id - Get specific call log details
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        
        // Get call log with assistant info to verify ownership
        const { data, error } = await supabase
            .from('call_logs')
            .select(`
                *,
                assistants!inner (
                    id,
                    name,
                    user_id
                ),
                phone_numbers (
                    id,
                    phone_number,
                    friendly_name
                )
            `)
            .eq('id', id)
            .eq('assistants.user_id', userId)
            .single();
            
        if (error || !data) {
            return res.status(404).json({
                success: false,
                error: 'Call log not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: data.id,
                assistantId: data.assistant_id,
                assistantName: data.assistants.name,
                phoneNumber: data.phone_numbers?.phone_number || 'Unknown',
                phoneNumberName: data.phone_numbers?.friendly_name || 'Unknown',
                callerNumber: data.caller_number,
                duration: data.duration_seconds,
                durationFormatted: formatDuration(data.duration_seconds),
                status: data.status,
                transcript: data.transcript,
                summary: data.summary,
                structuredData: data.structured_data,
                successEvaluation: data.success_evaluation,
                startedAt: data.started_at,
                endedAt: data.ended_at,
                createdAt: data.created_at
            }
        });
        
    } catch (error) {
        console.error('Error fetching call log:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to format duration
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

module.exports = router;