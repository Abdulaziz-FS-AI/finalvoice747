const { supabaseAdmin } = require('./supabase.service');

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    // Get analytics dashboard data for a user
    async getDashboardData(userId) {
        // Check cache first
        const cacheKey = `dashboard-${userId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            // Fetch all necessary data in parallel
            const [
                callStats,
                callHistory,
                assistantData,
                userProfile
            ] = await Promise.all([
                this.getCallStatistics(userId),
                this.getCallHistory(userId),
                this.getAssistantData(userId),
                this.getUserProfile(userId)
            ]);

            // Calculate remaining minutes
            const totalMinutesUsed = (assistantData?.total_call_duration_seconds || 0) / 60;
            const remainingMinutes = Math.max(0, 10 - totalMinutesUsed);

            const dashboardData = {
                metrics: {
                    totalCalls: callStats.totalCalls,
                    averageDuration: callStats.averageDuration,
                    successRate: callStats.successRate,
                    minutesRemaining: remainingMinutes.toFixed(1)
                },
                charts: {
                    callsOverTime: await this.getCallsOverTime(userId),
                    callStatusDistribution: callStats.statusDistribution,
                    hourlyDistribution: await this.getHourlyDistribution(userId)
                },
                callHistory: callHistory,
                userInfo: {
                    isDemo: userProfile?.is_demo_user || false,
                    demoExpiresAt: userProfile?.demo_expires_at,
                    daysRemaining: this.calculateDaysRemaining(userProfile?.demo_expires_at)
                }
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: dashboardData,
                timestamp: Date.now()
            });

            return dashboardData;
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            throw error;
        }
    }

    // Get call statistics
    async getCallStatistics(userId) {
        try {
            const { data: calls, error } = await supabaseAdmin
                .from('call_logs')
                .select('status, duration_seconds')
                .eq('user_id', userId);

            if (error) throw error;

            const totalCalls = calls.length;
            const completedCalls = calls.filter(c => c.status === 'completed').length;
            const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
            
            // Count by status
            const statusCounts = calls.reduce((acc, call) => {
                acc[call.status] = (acc[call.status] || 0) + 1;
                return acc;
            }, {});

            return {
                totalCalls,
                averageDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
                successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
                statusDistribution: statusCounts
            };
        } catch (error) {
            console.error('Error getting call statistics:', error);
            return {
                totalCalls: 0,
                averageDuration: 0,
                successRate: 0,
                statusDistribution: {}
            };
        }
    }

    // Get call history (last 50 calls)
    async getCallHistory(userId, limit = 50) {
        try {
            const { data, error } = await supabaseAdmin
                .from('call_logs')
                .select('*')
                .eq('user_id', userId)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Format for display
            return data.map(call => ({
                id: call.id,
                startedAt: call.started_at,
                endedAt: call.ended_at,
                duration: this.formatDuration(call.duration_seconds),
                durationSeconds: call.duration_seconds,
                status: call.status,
                statusDisplay: this.formatStatus(call.status),
                fromNumber: call.from_number || 'Unknown',
                toNumber: call.to_number || 'Unknown',
                summary: call.summary || 'No summary available',
                sentiment: call.sentiment || 'neutral'
            }));
        } catch (error) {
            console.error('Error getting call history:', error);
            return [];
        }
    }

    // Get assistant data
    async getAssistantData(userId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('assistants')
                .select('name, voice, total_call_duration_seconds')
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
            return data;
        } catch (error) {
            console.error('Error getting assistant data:', error);
            return null;
        }
    }

    // Get user profile
    async getUserProfile(userId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('is_demo_user, demo_expires_at')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    // Get calls over time (last 7 days)
    async getCallsOverTime(userId) {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data, error } = await supabaseAdmin
                .from('call_logs')
                .select('started_at')
                .eq('user_id', userId)
                .gte('started_at', sevenDaysAgo.toISOString());

            if (error) throw error;

            // Group by date
            const callsByDate = {};
            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                callsByDate[dateStr] = 0;
            }

            data.forEach(call => {
                const dateStr = call.started_at.split('T')[0];
                if (callsByDate.hasOwnProperty(dateStr)) {
                    callsByDate[dateStr]++;
                }
            });

            // Convert to array for Chart.js
            return Object.entries(callsByDate)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, count]) => ({
                    x: date,
                    y: count
                }));
        } catch (error) {
            console.error('Error getting calls over time:', error);
            return [];
        }
    }

    // Get hourly distribution
    async getHourlyDistribution(userId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('call_logs')
                .select('started_at')
                .eq('user_id', userId);

            if (error) throw error;

            // Initialize hours
            const hourCounts = Array(24).fill(0);

            // Count calls by hour
            data.forEach(call => {
                const hour = new Date(call.started_at).getHours();
                hourCounts[hour]++;
            });

            return hourCounts;
        } catch (error) {
            console.error('Error getting hourly distribution:', error);
            return Array(24).fill(0);
        }
    }

    // Helper: Format duration
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Helper: Format status
    formatStatus(status) {
        const statusMap = {
            'in-progress': 'In Progress',
            'completed': 'Completed',
            'failed': 'Failed',
            'missed': 'Missed',
            'declined': 'Declined'
        };
        return statusMap[status] || status;
    }

    // Helper: Calculate days remaining
    calculateDaysRemaining(expiresAt) {
        if (!expiresAt) return 0;
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffTime = expires - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }

    // Clear cache for a user
    clearUserCache(userId) {
        const cacheKey = `dashboard-${userId}`;
        this.cache.delete(cacheKey);
    }
}

module.exports = new AnalyticsService();