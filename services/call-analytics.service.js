class CallAnalyticsService {
    constructor(supabaseClient = null) {
        this.supabase = supabaseClient;
    }

    // Validation methods
    validateCallData(callData) {
        const errors = [];
        
        if (!callData.caller_number) {
            errors.push('Caller number is required');
        }
        
        if (!callData.duration_seconds || callData.duration_seconds < 0) {
            errors.push('Valid duration is required');
        }
        
        if (!callData.started_at) {
            errors.push('Start time is required');
        }
        
        return errors;
    }

    // Helper methods
    calculateStats(calls) {
        if (!calls || calls.length === 0) {
            return {
                totalCalls: 0,
                avgDuration: 0,
                totalCost: 0,
                successRate: 0
            };
        }

        const totalCalls = calls.length;
        const totalDuration = calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
        const totalCost = calls.reduce((sum, call) => sum + (call.cost || 0), 0);
        const completedCalls = calls.filter(call => call.status === 'completed').length;
        
        return {
            totalCalls,
            avgDuration: Math.round(totalDuration / totalCalls),
            totalCost: parseFloat(totalCost.toFixed(4)),
            successRate: parseFloat(((completedCalls / totalCalls) * 100).toFixed(1))
        };
    }

    buildDateFilter(dateRange) {
        const now = new Date();
        let startDate;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to week
        }

        return startDate.toISOString();
    }

    // Database methods
    async createCallRecord(userId, callData) {
        // Validation
        const validationErrors = this.validateCallData(callData);
        if (validationErrors.length > 0) {
            return {
                success: false,
                error: 'Validation failed',
                details: validationErrors
            };
        }

        if (!this.supabase) {
            // Mock response when no database
            return {
                success: true,
                data: {
                    id: 'mock-call-' + Date.now(),
                    ...callData,
                    created_at: new Date().toISOString()
                }
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('call_analytics')
                .insert({
                    user_id: userId,
                    assistant_id: callData.assistant_id || null,
                    phone_number_id: callData.phone_number_id || null,
                    caller_number: callData.caller_number,
                    duration_seconds: callData.duration_seconds,
                    cost: callData.cost || 0,
                    started_at: callData.started_at,
                    transcript: callData.transcript || null,
                    structured_data: callData.structured_data || null,
                    success_evaluation: callData.success_evaluation || null,
                    summary: callData.summary || null,
                    status: callData.status || 'completed'
                })
                .select()
                .single();

            if (error) {
                console.error('Database insertion error:', error);
                return {
                    success: false,
                    error: 'Failed to save call record to database'
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Database error:', error);
            return {
                success: false,
                error: 'Database error occurred'
            };
        }
    }

    async getCallAnalytics(userId, filters = {}) {
        if (!this.supabase) {
            // Return mock data when no database
            const mockCalls = [
                {
                    id: '1',
                    caller_number: '+14155551234',
                    assistant_name: 'Customer Support Bot',
                    duration_seconds: 247,
                    cost: 0.0823,
                    status: 'completed',
                    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    transcript: 'Customer: Hi, I need help with my account.\nAssistant: I\'d be happy to help you with your account. Can you please provide me with your account number?\nCustomer: Sure, it\'s 12345.\nAssistant: Thank you. I can see your account here. What specific issue are you experiencing?',
                    structured_data: { customer_name: 'John Doe', account_number: '12345', issue_type: 'account_access' },
                    success_evaluation: { score: 8.5, criteria: 'Helpful and resolved issue' },
                    summary: 'Customer called for account assistance. Successfully helped with account access issue.'
                },
                {
                    id: '2',
                    caller_number: '+14155559876',
                    assistant_name: 'Sales Assistant',
                    duration_seconds: 156,
                    cost: 0.0521,
                    status: 'completed',
                    started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                    transcript: 'Customer: I\'m interested in your premium plan.\nAssistant: Great! I\'d be happy to tell you about our premium plan features.',
                    structured_data: { interest_level: 'high', plan_type: 'premium' },
                    success_evaluation: { score: 9.2, criteria: 'Engaged customer, likely conversion' },
                    summary: 'Sales inquiry for premium plan. High conversion potential.'
                },
                {
                    id: '3',
                    caller_number: '+14155557890',
                    assistant_name: 'Customer Support Bot',
                    duration_seconds: 45,
                    cost: 0.0150,
                    status: 'abandoned',
                    started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                    transcript: 'Customer: Hello?\n[Call ended]',
                    structured_data: null,
                    success_evaluation: null,
                    summary: 'Call abandoned early, no interaction.'
                }
            ];

            // Apply filters to mock data
            let filteredCalls = [...mockCalls];
            
            if (filters.status) {
                filteredCalls = filteredCalls.filter(call => call.status === filters.status);
            }
            
            if (filters.assistantId) {
                // For mock data, filter by assistant name (simplified)
                filteredCalls = filteredCalls.filter(call => 
                    call.assistant_name.toLowerCase().includes('support') && filters.assistantId === '1' ||
                    call.assistant_name.toLowerCase().includes('sales') && filters.assistantId === '2'
                );
            }

            const stats = this.calculateStats(filteredCalls);

            return {
                success: true,
                data: filteredCalls,
                stats: stats
            };
        }

        try {
            // Build the query
            let query = this.supabase
                .from('call_analytics')
                .select(`
                    *,
                    assistants:assistant_id (
                        name,
                        company_name
                    ),
                    phone_numbers:phone_number_id (
                        phone_number,
                        friendly_name
                    )
                `)
                .eq('user_id', userId);

            // Apply filters
            if (filters.dateRange) {
                const startDate = this.buildDateFilter(filters.dateRange);
                query = query.gte('started_at', startDate);
            }

            if (filters.assistantId) {
                query = query.eq('assistant_id', filters.assistantId);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            // Order by most recent first
            query = query.order('started_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching call analytics:', error);
                return {
                    success: false,
                    error: 'Failed to fetch call analytics'
                };
            }

            // Transform data for frontend
            const transformedData = data.map(call => ({
                id: call.id,
                caller_number: call.caller_number,
                assistant_name: call.assistants?.name || 'Unknown',
                assistant_company: call.assistants?.company_name || '',
                phone_number: call.phone_numbers?.phone_number || '',
                phone_friendly_name: call.phone_numbers?.friendly_name || '',
                duration_seconds: call.duration_seconds,
                cost: call.cost,
                status: call.status,
                started_at: call.started_at,
                transcript: call.transcript,
                structured_data: call.structured_data,
                success_evaluation: call.success_evaluation,
                summary: call.summary,
                created_at: call.created_at
            }));

            const stats = this.calculateStats(transformedData);

            return {
                success: true,
                data: transformedData,
                stats: stats
            };
        } catch (error) {
            console.error('Database error:', error);
            return {
                success: false,
                error: 'Database error occurred'
            };
        }
    }

    async getCallById(userId, callId) {
        if (!this.supabase) {
            // Mock response
            return {
                success: true,
                data: {
                    id: callId,
                    caller_number: '+14155551234',
                    duration_seconds: 247,
                    cost: 0.0823,
                    status: 'completed',
                    started_at: new Date().toISOString(),
                    transcript: 'Mock call transcript...',
                    structured_data: { test: 'data' },
                    success_evaluation: { score: 8.5 },
                    summary: 'Mock call summary'
                }
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('call_analytics')
                .select(`
                    *,
                    assistants:assistant_id (
                        name,
                        company_name
                    ),
                    phone_numbers:phone_number_id (
                        phone_number,
                        friendly_name
                    )
                `)
                .eq('id', callId)
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return {
                    success: false,
                    error: 'Call record not found'
                };
            }

            return {
                success: true,
                data: {
                    id: data.id,
                    caller_number: data.caller_number,
                    assistant_name: data.assistants?.name || 'Unknown',
                    assistant_company: data.assistants?.company_name || '',
                    phone_number: data.phone_numbers?.phone_number || '',
                    phone_friendly_name: data.phone_numbers?.friendly_name || '',
                    duration_seconds: data.duration_seconds,
                    cost: data.cost,
                    status: data.status,
                    started_at: data.started_at,
                    transcript: data.transcript,
                    structured_data: data.structured_data,
                    success_evaluation: data.success_evaluation,
                    summary: data.summary,
                    created_at: data.created_at,
                    updated_at: data.updated_at
                }
            };
        } catch (error) {
            console.error('Database error:', error);
            return {
                success: false,
                error: 'Database error occurred'
            };
        }
    }

    async deleteCallRecord(userId, callId) {
        if (!this.supabase) {
            return { success: true };
        }

        try {
            const { error } = await this.supabase
                .from('call_analytics')
                .delete()
                .eq('id', callId)
                .eq('user_id', userId);

            if (error) {
                console.error('Database deletion error:', error);
                return {
                    success: false,
                    error: 'Failed to delete call record'
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Deletion error:', error);
            return {
                success: false,
                error: 'Deletion operation failed'
            };
        }
    }

    // Webhook handler for incoming call data from VAPI
    async handleWebhookData(webhookData) {
        try {
            // Extract data from VAPI webhook payload
            const callData = {
                caller_number: webhookData.message?.customer?.number || webhookData.caller_number,
                duration_seconds: webhookData.message?.durationSeconds || webhookData.duration_seconds,
                cost: webhookData.message?.cost || webhookData.cost,
                started_at: webhookData.message?.started_at || new Date().toISOString(),
                transcript: webhookData.message?.transcript || webhookData.transcript,
                structured_data: webhookData.message?.analysis?.structuredData || webhookData.structured_data,
                success_evaluation: webhookData.message?.analysis?.successEvaluation || webhookData.success_evaluation,
                summary: webhookData.message?.analysis?.summary || webhookData.summary,
                status: webhookData.message?.status || 'completed'
            };

            // Get user_id and assistant_id from VAPI assistant ID or phone number
            let userId = webhookData.user_id;
            let assistantId = webhookData.assistant_id;
            let phoneNumberId = null;

            // If no user_id provided, look up by VAPI assistant ID
            if (!userId && webhookData.message?.assistant?.id) {
                const assistantLookup = await this.getUserByVAPIAssistantId(webhookData.message.assistant.id);
                if (assistantLookup.success) {
                    userId = assistantLookup.data.user_id;
                    assistantId = assistantLookup.data.assistant_id;
                }
            }

            // If still no user_id, look up by phone number that received the call
            if (!userId && webhookData.message?.phoneNumber?.number) {
                const phoneLookup = await this.getUserByPhoneNumber(webhookData.message.phoneNumber.number);
                if (phoneLookup.success) {
                    userId = phoneLookup.data.user_id;
                    assistantId = phoneLookup.data.assistant_id;
                    phoneNumberId = phoneLookup.data.phone_number_id;
                }
            }

            // Fallback to default user for testing
            if (!userId) {
                userId = '00000000-0000-0000-0000-000000000000';
                console.warn('Could not determine user_id from webhook, using default');
            }

            if (assistantId) {
                callData.assistant_id = assistantId;
            }
            if (phoneNumberId) {
                callData.phone_number_id = phoneNumberId;
            }

            return await this.createCallRecord(userId, callData);
        } catch (error) {
            console.error('Webhook processing error:', error);
            return {
                success: false,
                error: 'Failed to process webhook data'
            };
        }
    }

    // Helper method to lookup user by VAPI assistant ID
    async getUserByVAPIAssistantId(vapiAssistantId) {
        if (!this.supabase) {
            return { success: false, error: 'No database connection' };
        }

        try {
            const { data, error } = await this.supabase
                .from('assistants')
                .select('id, user_id')
                .eq('vapi_assistant_id', vapiAssistantId)
                .single();

            if (error || !data) {
                return { success: false, error: 'Assistant not found' };
            }

            return {
                success: true,
                data: {
                    user_id: data.user_id,
                    assistant_id: data.id
                }
            };
        } catch (error) {
            console.error('Database lookup error:', error);
            return { success: false, error: 'Database error' };
        }
    }

    // Helper method to lookup user by phone number
    async getUserByPhoneNumber(phoneNumber) {
        if (!this.supabase) {
            return { success: false, error: 'No database connection' };
        }

        try {
            const { data, error } = await this.supabase
                .from('phone_numbers')
                .select('user_id, assigned_assistant_id, id')
                .eq('phone_number', phoneNumber)
                .single();

            if (error || !data) {
                return { success: false, error: 'Phone number not found' };
            }

            return {
                success: true,
                data: {
                    user_id: data.user_id,
                    assistant_id: data.assigned_assistant_id,
                    phone_number_id: data.id
                }
            };
        } catch (error) {
            console.error('Database lookup error:', error);
            return { success: false, error: 'Database error' };
        }
    }

    // Export data methods
    async exportCallData(userId, filters = {}, format = 'json') {
        const result = await this.getCallAnalytics(userId, filters);
        
        if (!result.success) {
            return result;
        }

        const data = result.data;

        switch (format.toLowerCase()) {
            case 'csv':
                return this.exportToCSV(data);
            case 'json':
                return {
                    success: true,
                    data: JSON.stringify(data, null, 2),
                    contentType: 'application/json',
                    filename: `call-analytics-${new Date().toISOString().split('T')[0]}.json`
                };
            default:
                return {
                    success: false,
                    error: 'Unsupported export format'
                };
        }
    }

    exportToCSV(data) {
        if (!data || data.length === 0) {
            return {
                success: false,
                error: 'No data to export'
            };
        }

        const headers = [
            'ID', 'Date/Time', 'Caller Number', 'Assistant', 'Duration (seconds)', 
            'Cost', 'Status', 'Summary'
        ];

        const csvRows = [
            headers.join(','),
            ...data.map(call => [
                call.id,
                call.started_at,
                call.caller_number,
                call.assistant_name || 'Unknown',
                call.duration_seconds,
                call.cost || 0,
                call.status,
                (call.summary || '').replace(/,/g, ';').replace(/\n/g, ' ')
            ].join(','))
        ];

        return {
            success: true,
            data: csvRows.join('\n'),
            contentType: 'text/csv',
            filename: `call-analytics-${new Date().toISOString().split('T')[0]}.csv`
        };
    }
}

module.exports = CallAnalyticsService;