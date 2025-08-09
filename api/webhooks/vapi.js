const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../services/supabase.service');

// VAPI webhook endpoint for call events
router.post('/', async (req, res) => {
    try {
        const event = req.body;
        
        console.log('VAPI webhook received:', event.type);
        
        switch (event.type) {
            case 'call.started':
                await handleCallStarted(event);
                break;
                
            case 'call.ended':
                await handleCallEnded(event);
                break;
                
            case 'end-of-call-report':
                await handleEndOfCallReport(event);
                break;
                
            default:
                console.log('Unhandled event type:', event.type);
        }
        
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Handle call started event
async function handleCallStarted(event) {
    try {
        const { call } = event;
        
        // Get assistant ID from call data
        const assistantId = await getAssistantIdFromVapi(call.assistantId);
        if (!assistantId) {
            console.error('Assistant not found for VAPI ID:', call.assistantId);
            return;
        }
        
        // Create call log entry
        const { error } = await supabaseAdmin
            .from('call_logs')
            .insert({
                vapi_call_id: call.id,
                assistant_id: assistantId,
                phone_number_id: await getPhoneNumberId(call.phoneNumberId),
                caller_number: call.customer?.number || null,
                status: 'in_progress',
                started_at: call.startedAt || new Date().toISOString()
            });
            
        if (error) {
            console.error('Error creating call log:', error);
        }
    } catch (error) {
        console.error('Error handling call started:', error);
    }
}

// Handle call ended event
async function handleCallEnded(event) {
    try {
        const { call } = event;
        
        // Update call log with duration
        const durationSeconds = Math.round((call.endedAt - call.startedAt) / 1000);
        
        const { error } = await supabaseAdmin
            .from('call_logs')
            .update({
                status: mapCallStatus(call.endedReason),
                duration_seconds: durationSeconds,
                ended_at: call.endedAt || new Date().toISOString()
            })
            .eq('vapi_call_id', call.id);
            
        if (error) {
            console.error('Error updating call log:', error);
        }
        
        // Check if user hit 10-minute limit
        await checkAndEnforceCallLimits(call.assistantId);
    } catch (error) {
        console.error('Error handling call ended:', error);
    }
}

// Handle end-of-call report (with transcript and analysis)
async function handleEndOfCallReport(event) {
    try {
        const { call, transcript, summary, analysis } = event;
        
        // Update call log with transcript and analysis
        const { error } = await supabaseAdmin
            .from('call_logs')
            .update({
                transcript: transcript || null,
                summary: summary || null,
                structured_data: analysis?.structuredData || null,
                success_evaluation: analysis?.successEvaluation || null,
                updated_at: new Date().toISOString()
            })
            .eq('vapi_call_id', call.id);
            
        if (error) {
            console.error('Error updating call report:', error);
        }
    } catch (error) {
        console.error('Error handling end-of-call report:', error);
    }
}

// Helper: Get our assistant ID from VAPI assistant ID
async function getAssistantIdFromVapi(vapiAssistantId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('assistants')
            .select('id, user_id')
            .eq('vapi_assistant_id', vapiAssistantId)
            .single();
            
        if (error || !data) return null;
        
        return data.id;
    } catch (error) {
        console.error('Error getting assistant ID:', error);
        return null;
    }
}

// Helper: Get phone number ID from VAPI phone ID
async function getPhoneNumberId(vapiPhoneId) {
    if (!vapiPhoneId) return null;
    
    try {
        const { data, error } = await supabaseAdmin
            .from('phone_numbers')
            .select('id')
            .eq('vapi_phone_id', vapiPhoneId)
            .single();
            
        if (error || !data) return null;
        
        return data.id;
    } catch (error) {
        console.error('Error getting phone number ID:', error);
        return null;
    }
}

// Helper: Map VAPI call status to our status
function mapCallStatus(endedReason) {
    const statusMap = {
        'customer-ended-call': 'completed',
        'assistant-ended-call': 'completed',
        'customer-did-not-answer': 'no-answer',
        'customer-busy': 'busy',
        'system-error': 'failed',
        'max-duration-reached': 'completed',
        'silence-timeout': 'completed'
    };
    
    return statusMap[endedReason] || 'failed';
}

// Check and enforce 10-minute call limit
async function checkAndEnforceCallLimits(vapiAssistantId) {
    try {
        // Get assistant and user info
        const { data: assistant, error: assistantError } = await supabaseAdmin
            .from('assistants')
            .select('id, user_id')
            .eq('vapi_assistant_id', vapiAssistantId)
            .single();
            
        if (assistantError || !assistant) return;
        
        // Check user's total call usage
        const { data: usage, error: usageError } = await supabaseAdmin
            .rpc('get_user_call_usage', { user_uuid: assistant.user_id });
            
        if (usageError || !usage || !usage[0]) return;
        
        const totalMinutes = usage[0].total_call_minutes;
        
        // If user hit 10-minute limit, delete their account (silent)
        if (totalMinutes >= 10) {
            console.log(`User ${assistant.user_id} hit 10-minute limit, scheduling deletion`);
            
            // Delete user (cascades will handle everything)
            await supabaseAdmin.auth.admin.deleteUser(assistant.user_id);
        }
    } catch (error) {
        console.error('Error checking call limits:', error);
    }
}

module.exports = router;