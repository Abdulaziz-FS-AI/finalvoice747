const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const assistantService = require('../../services/assistant.service');

// GET /api/assistants - Get all assistants for user
router.get('/', requireAuth, async (req, res) => {
    try {
        const assistants = await assistantService.getAssistants(req.userId);
        
        res.json({
            success: true,
            data: assistants
        });
    } catch (error) {
        console.error('Error fetching assistants:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch assistants'
        });
    }
});

// GET /api/assistants/usage - Get user's call usage (MUST BE BEFORE /:id route)
router.get('/usage', requireAuth, async (req, res) => {
    try {
        const usage = await assistantService.getUserCallUsage(req.userId);
        
        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch usage'
        });
    }
});

// GET /api/assistants/:id - Get specific assistant
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const assistant = await assistantService.getAssistant(req.params.id, req.userId);
        
        if (!assistant) {
            return res.status(404).json({
                success: false,
                error: 'Assistant not found'
            });
        }
        
        res.json({
            success: true,
            data: assistant
        });
    } catch (error) {
        console.error('Error fetching assistant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch assistant'
        });
    }
});

// Validate assistant creation data
function validateAssistantData(data) {
    const errors = [];
    
    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Assistant name is required');
    } else if (data.name.length > 100) {
        errors.push('Assistant name must be less than 100 characters');
    }
    
    if (!data.first_message || typeof data.first_message !== 'string' || data.first_message.trim().length === 0) {
        errors.push('First message is required');
    } else if (data.first_message.length > 500) {
        errors.push('First message must be less than 500 characters');
    }
    
    // Optional fields validation
    if (data.max_call_duration) {
        const duration = parseInt(data.max_call_duration);
        if (isNaN(duration) || duration < 30 || duration > 1800) { // 30 seconds to 30 minutes
            errors.push('Call duration must be between 30 and 1800 seconds');
        }
    }
    
    if (data.voice_id && (typeof data.voice_id !== 'string' || data.voice_id.length > 50)) {
        errors.push('Invalid voice ID');
    }
    
    if (data.evaluation_method && !['NumericScale', 'DescriptiveScale', 'Checklist', 'BinaryEvaluation', 'NoEvaluation'].includes(data.evaluation_method)) {
        errors.push('Invalid evaluation method');
    }
    
    if (data.background_sound && !['office', 'cafe', 'nature', 'none'].includes(data.background_sound)) {
        errors.push('Invalid background sound option');
    }
    
    // Validate personality traits
    if (data.personality_traits) {
        const validTraits = ['Professional', 'Friendly', 'Energetic', 'Calming', 'Confident', 'Empathetic', 'Witty', 'Patient', 'Knowledgeable', 'Supportive'];
        const traits = Array.isArray(data.personality_traits) ? data.personality_traits : [data.personality_traits];
        
        for (const trait of traits) {
            if (!validTraits.includes(trait)) {
                errors.push(`Invalid personality trait: ${trait}`);
            }
        }
        
        if (traits.length > 5) {
            errors.push('Maximum 5 personality traits allowed');
        }
    }
    
    // Validate structured questions
    if (data.structured_questions && Array.isArray(data.structured_questions)) {
        if (data.structured_questions.length > 10) {
            errors.push('Maximum 10 structured questions allowed');
        }
        
        data.structured_questions.forEach((q, index) => {
            if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
                errors.push(`Question ${index + 1}: Question text is required`);
            } else if (q.question.length > 200) {
                errors.push(`Question ${index + 1}: Question text must be less than 200 characters`);
            }
            
            if (q.description && q.description.length > 300) {
                errors.push(`Question ${index + 1}: Description must be less than 300 characters`);
            }
        });
    }
    
    return errors;
}

// POST /api/assistants - Create new assistant
router.post('/', requireAuth, async (req, res) => {
    try {
        console.log(`\n🔍 Assistant creation request for user: ${req.userId}`);
        console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
        
        // Validate input data
        const validationErrors = validateAssistantData(req.body);
        if (validationErrors.length > 0) {
            console.log('❌ Validation errors:', validationErrors);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }
        
        // Check limits first
        const limits = await assistantService.canCreateAssistant(req.userId);
        console.log('📊 Limit check result:', limits);
        
        if (!limits.can_create_assistant) {
            console.log(`❌ Assistant creation blocked:`, {
                reason: limits.reason,
                assistantCount: limits.assistant_count,
                maxAssistants: limits.max_assistants,
                demoExpired: limits.demo_expired
            });
            
            // Return more informative response for debugging
            return res.json({
                success: true,
                data: null,
                debug: {
                    blocked: true,
                    reason: limits.reason,
                    assistantCount: limits.assistant_count,
                    maxAssistants: limits.max_assistants,
                    demoExpired: limits.demo_expired
                }
            });
        }
        
        console.log('✅ Validation passed, limit check passed, creating assistant...');
        
        // Create assistant
        const assistant = await assistantService.createAssistant(req.userId, req.body);
        
        if (!assistant) {
            console.log('❌ Assistant creation failed in service layer');
            return res.json({
                success: true,
                data: null,
                debug: {
                    blocked: true,
                    reason: 'service_creation_failed'
                }
            });
        }
        
        console.log('✅ Assistant created successfully:', assistant.id);
        
        res.json({
            success: true,
            data: assistant
        });
    } catch (error) {
        console.error('💥 Error creating assistant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create assistant',
            debug: {
                error: error.message,
                stack: error.stack
            }
        });
    }
});

// DELETE /api/assistants/:id - Delete assistant
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const success = await assistantService.deleteAssistant(req.params.id, req.userId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Assistant not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Assistant deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting assistant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete assistant'
        });
    }
});

module.exports = router;