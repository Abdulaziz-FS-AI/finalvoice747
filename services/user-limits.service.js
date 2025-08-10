class UserLimitsService {
    constructor(supabaseClient = null, assistantService = null, phoneNumberService = null) {
        this.supabase = supabaseClient;
        this.assistantService = assistantService;
        this.phoneNumberService = phoneNumberService;
    }

    // Initialize user limits when they first sign up
    async initializeUserLimits(userId, planType = 'free') {
        const planLimits = this.getPlanLimits(planType);
        
        if (!this.supabase) {
            // Mock response for testing
            return {
                success: true,
                data: {
                    user_id: userId,
                    max_assistants: planLimits.maxAssistants,
                    max_call_time_seconds: planLimits.maxCallTimeSeconds,
                    current_assistants: 0,
                    used_call_time_seconds: 0,
                    plan_type: planType
                }
            };
        }

        try {
            // Check if user limits already exist
            const { data: existing } = await this.supabase
                .from('user_limits')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (existing) {
                return { success: true, data: existing };
            }

            // Create new user limits
            const { data, error } = await this.supabase
                .from('user_limits')
                .insert({
                    user_id: userId,
                    max_assistants: planLimits.maxAssistants,
                    max_call_time_seconds: planLimits.maxCallTimeSeconds,
                    current_assistants: 0,
                    used_call_time_seconds: 0,
                    plan_type: planType
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating user limits:', error);
                return { success: false, error: 'Failed to initialize user limits' };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Get plan limits configuration
    getPlanLimits(planType) {
        const plans = {
            free: {
                maxAssistants: 2,
                maxCallTimeSeconds: 600 // 10 minutes
            },
            pro: {
                maxAssistants: 10,
                maxCallTimeSeconds: 3600 // 60 minutes
            },
            business: {
                maxAssistants: 50,
                maxCallTimeSeconds: 18000 // 300 minutes
            },
            enterprise: {
                maxAssistants: -1, // Unlimited
                maxCallTimeSeconds: -1 // Unlimited
            }
        };

        return plans[planType] || plans.free;
    }

    // Get current user usage and limits
    async getUserLimits(userId) {
        // Check if demo has expired first
        const expiredCheck = await this.checkDemoExpiry(userId);
        if (expiredCheck.expired) {
            return {
                success: false,
                error: 'Demo expired',
                expired: true
            };
        }
        
        // Ensure user limits exist
        await this.initializeUserLimits(userId);

        if (!this.supabase) {
            // Mock data for testing
            return {
                success: true,
                data: {
                    user_id: userId,
                    max_assistants: 1,
                    current_assistants: 1,
                    max_call_time_seconds: 600,
                    used_call_time_seconds: 450, // 7.5 minutes
                    plan_type: 'free',
                    remaining_assistants: 0,
                    remaining_call_time_seconds: 150,
                    usage_percentage: {
                        assistants: 100.0,
                        call_time: 75.0
                    }
                }
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('user_limits')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching user limits:', error);
                return { success: false, error: 'Failed to fetch user limits' };
            }

            // Calculate derived values
            const remainingAssistants = Math.max(0, data.max_assistants - data.current_assistants);
            const remainingCallTime = Math.max(0, data.max_call_time_seconds - data.used_call_time_seconds);
            
            const usagePercentage = {
                assistants: data.max_assistants > 0 ? (data.current_assistants / data.max_assistants) * 100 : 0,
                call_time: data.max_call_time_seconds > 0 ? (data.used_call_time_seconds / data.max_call_time_seconds) * 100 : 0
            };

            return {
                success: true,
                data: {
                    ...data,
                    remaining_assistants: remainingAssistants,
                    remaining_call_time_seconds: remainingCallTime,
                    usage_percentage: usagePercentage
                }
            };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Check if user can create an assistant
    async canCreateAssistant(userId) {
        const limitsResult = await this.getUserLimits(userId);
        if (!limitsResult.success) return limitsResult;

        const limits = limitsResult.data;
        const canCreate = limits.current_assistants < limits.max_assistants;

        return {
            success: true,
            allowed: canCreate,
            current: limits.current_assistants,
            max: limits.max_assistants,
            remaining: limits.remaining_assistants
        };
    }

    // Increment assistant count when creating
    async incrementAssistantCount(userId) {
        if (!this.supabase) {
            return { success: true };
        }

        try {
            const { data, error } = await this.supabase
                .from('user_limits')
                .update({
                    current_assistants: this.supabase.rpc('increment_assistants', { user_id: userId }),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error incrementing assistant count:', error);
                return { success: false, error: 'Failed to update assistant count' };
            }

            // Log the action
            await this.logUsageAction(userId, 'assistant_created', null, 1, 0, 'user_action');

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Decrement assistant count when deleting
    async decrementAssistantCount(userId) {
        if (!this.supabase) {
            return { success: true };
        }

        try {
            const { data, error } = await this.supabase
                .from('user_limits')
                .update({
                    current_assistants: Math.max(0, this.supabase.rpc('decrement_assistants', { user_id: userId })),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error decrementing assistant count:', error);
                return { success: false, error: 'Failed to update assistant count' };
            }

            // Log the action
            await this.logUsageAction(userId, 'assistant_deleted', null, -1, 0, 'user_action');

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Add call time and check for limit exceeded
    async addCallTime(userId, durationSeconds, callId = null) {
        if (!this.supabase) {
            // Mock response - simulate limit exceeded for testing
            return {
                success: true,
                limitExceeded: durationSeconds > 300, // Mock: exceed if single call > 5 min
                newTotal: 450 + durationSeconds,
                limit: 600
            };
        }

        try {
            // Get current usage
            const limitsResult = await this.getUserLimits(userId);
            if (!limitsResult.success) return limitsResult;

            const currentUsage = limitsResult.data.used_call_time_seconds;
            const newTotal = currentUsage + durationSeconds;
            const limit = limitsResult.data.max_call_time_seconds;
            const limitExceeded = newTotal > limit;

            // Update the usage
            const { data, error } = await this.supabase
                .from('user_limits')
                .update({
                    used_call_time_seconds: newTotal,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error updating call time:', error);
                return { success: false, error: 'Failed to update call time' };
            }

            // Log the action
            await this.logUsageAction(userId, 'call_completed', callId, 0, durationSeconds, 'user_action');

            // Check if limit exceeded and trigger auto-deletion
            if (limitExceeded) {
                console.log(`User ${userId} exceeded call time limit. Triggering auto-deletion.`);
                
                await this.logUsageAction(userId, 'limit_exceeded', callId, 0, 0, 'limit_exceeded', {
                    old_total: currentUsage,
                    new_total: newTotal,
                    limit: limit,
                    overage: newTotal - limit
                });

                // Trigger auto-deletion
                const deletionResult = await this.triggerAutoDeletion(userId);
                
                return {
                    success: true,
                    limitExceeded: true,
                    newTotal,
                    limit,
                    overage: newTotal - limit,
                    autoDeletion: deletionResult
                };
            }

            return {
                success: true,
                limitExceeded: false,
                newTotal,
                limit,
                remaining: limit - newTotal
            };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Trigger automatic deletion when limit exceeded
    async triggerAutoDeletion(userId) {
        try {
            console.log(`Starting auto-deletion process for user ${userId}`);

            // Get user's assistants (oldest first as deletion priority)
            const assistants = await this.assistantService.getAssistants(userId);
            if (!assistants.success || assistants.data.length === 0) {
                return { success: false, error: 'No assistants found to delete' };
            }

            // Select the oldest assistant for deletion
            const assistantToDelete = assistants.data.sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            )[0];

            console.log(`Selected assistant for deletion: ${assistantToDelete.id} (${assistantToDelete.name})`);

            // Get all phone numbers assigned to this assistant
            const phoneNumbers = await this.phoneNumberService.getPhoneNumbers(userId);
            const assistantPhoneNumbers = phoneNumbers.success ? 
                phoneNumbers.data.filter(phone => phone.assignedAssistantId === assistantToDelete.id) : [];

            console.log(`Found ${assistantPhoneNumbers.length} phone numbers to delete`);

            // Delete all phone numbers assigned to this assistant first
            const phoneNumberDeletions = [];
            for (const phoneNumber of assistantPhoneNumbers) {
                const deleteResult = await this.phoneNumberService.deletePhoneNumber(userId, phoneNumber.id);
                phoneNumberDeletions.push({
                    id: phoneNumber.id,
                    friendlyName: phoneNumber.friendlyName,
                    success: deleteResult.success
                });

                if (deleteResult.success) {
                    await this.logUsageAction(userId, 'phone_number_deleted', phoneNumber.id, 0, 0, 'limit_exceeded');
                }
            }

            // Delete the assistant
            const assistantDeletionResult = await this.assistantService.deleteAssistant(userId, assistantToDelete.id);

            if (assistantDeletionResult.success) {
                // Update assistant count
                await this.decrementAssistantCount(userId);

                // NO RESET - Demo deletion is permanent
                // User loses everything when limits exceeded

                // Log the auto-deletion action
                await this.logUsageAction(userId, 'auto_deletion_triggered', assistantToDelete.id, -1, 0, 'limit_exceeded', {
                    deleted_assistant: {
                        id: assistantToDelete.id,
                        name: assistantToDelete.name
                    },
                    deleted_phone_numbers: phoneNumberDeletions,
                    call_time_reset: true
                });

                // Update deletion tracking
                if (this.supabase) {
                    await this.supabase
                        .from('user_limits')
                        .update({
                            last_deletion_at: new Date().toISOString(),
                            deletion_count: this.supabase.rpc('increment_deletion_count', { user_id: userId })
                        })
                        .eq('user_id', userId);
                }

                console.log(`Auto-deletion completed successfully for user ${userId}`);

                return {
                    success: true,
                    deletedAssistant: {
                        id: assistantToDelete.id,
                        name: assistantToDelete.name
                    },
                    deletedPhoneNumbers: phoneNumberDeletions,
                    callTimeReset: false,
                    message: null
                };
            } else {
                console.error('Failed to delete assistant during auto-deletion:', assistantDeletionResult.error);
                return {
                    success: false,
                    error: 'Failed to delete assistant: ' + assistantDeletionResult.error
                };
            }
        } catch (error) {
            console.error('Auto-deletion process failed:', error);
            return {
                success: false,
                error: 'Auto-deletion process failed: ' + error.message
            };
        }
    }

    // Reset call time usage (used after auto-deletion)
    async resetCallTimeUsage(userId) {
        if (!this.supabase) {
            return { success: true };
        }

        try {
            const { data, error } = await this.supabase
                .from('user_limits')
                .update({
                    used_call_time_seconds: 0,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error resetting call time:', error);
                return { success: false, error: 'Failed to reset call time' };
            }

            await this.logUsageAction(userId, 'billing_cycle_reset', null, 0, 0, 'auto_reset');

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Log usage actions for audit trail
    async logUsageAction(userId, actionType, resourceId, assistantCountChange, callTimeChange, triggerReason, details = null) {
        if (!this.supabase) {
            console.log(`[MOCK] Usage log: ${actionType} for user ${userId}`);
            return { success: true };
        }

        try {
            const { error } = await this.supabase
                .from('usage_logs')
                .insert({
                    user_id: userId,
                    action_type: actionType,
                    resource_id: resourceId,
                    assistant_count_change: assistantCountChange,
                    call_time_change_seconds: callTimeChange,
                    trigger_reason: triggerReason,
                    details: details
                });

            if (error) {
                console.error('Error logging usage action:', error);
                return { success: false, error: 'Failed to log usage action' };
            }

            return { success: true };
        } catch (error) {
            console.error('Usage logging error:', error);
            return { success: false, error: 'Usage logging error occurred' };
        }
    }

    // Get usage history for a user
    async getUserUsageHistory(userId, limit = 50) {
        if (!this.supabase) {
            // Mock usage history
            return {
                success: true,
                data: [
                    {
                        action_type: 'call_completed',
                        call_time_change_seconds: 120,
                        created_at: new Date(Date.now() - 60000).toISOString(),
                        details: { caller_number: '+14155551234' }
                    },
                    {
                        action_type: 'assistant_created',
                        assistant_count_change: 1,
                        created_at: new Date(Date.now() - 3600000).toISOString(),
                        details: { assistant_name: 'Support Bot' }
                    }
                ]
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('usage_logs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching usage history:', error);
                return { success: false, error: 'Failed to fetch usage history' };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Database error:', error);
            return { success: false, error: 'Database error occurred' };
        }
    }

    // Format time in MM:SS format
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Check if demo account has expired
    async checkDemoExpiry(userId) {
        if (!this.supabase) {
            // Mock - never expired for testing
            return { expired: false };
        }

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('demo_expires_at, is_demo_user, email')
                .eq('id', userId)
                .single();

            if (error || !data) {
                return { expired: false };
            }

            // Check if demo user and expired
            if (data.is_demo_user && new Date(data.demo_expires_at) < new Date()) {
                return { 
                    expired: true, 
                    expiry_date: data.demo_expires_at,
                    email: data.email
                };
            }

            return { expired: false, expires_at: data.demo_expires_at };
        } catch (error) {
            console.error('Error checking demo expiry:', error);
            return { expired: false };
        }
    }

    // Get demo time remaining
    async getDemoTimeRemaining(userId) {
        const expiryCheck = await this.checkDemoExpiry(userId);
        if (expiryCheck.expired) return null;
        
        if (expiryCheck.expires_at) {
            const now = new Date();
            const expires = new Date(expiryCheck.expires_at);
            const remainingMs = expires.getTime() - now.getTime();
            const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
            
            return {
                days: remainingDays,
                expires_at: expiryCheck.expires_at,
                expires_formatted: expires.toLocaleDateString()
            };
        }
        
        return null;
    }

    // Check if user needs warning about approaching limits
    getUsageWarnings(usageData) {
        const warnings = [];

        // NO WARNINGS - Users discover limits by hitting them

        return warnings;
    }
}

module.exports = UserLimitsService;