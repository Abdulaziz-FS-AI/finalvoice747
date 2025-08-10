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

// POST /api/assistants - Create new assistant
router.post('/', requireAuth, async (req, res) => {
    try {
        console.log(`\n🔍 Assistant creation request for user: ${req.userId}`);
        console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
        
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
        
        console.log('✅ Limit check passed, creating assistant...');
        
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