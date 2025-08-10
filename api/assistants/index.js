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
        // Check limits first
        const limits = await assistantService.canCreateAssistant(req.userId);
        if (!limits.can_create_assistant) {
            // Silent failure - act like success but return null
            return res.json({
                success: true,
                data: null
            });
        }
        
        // Create assistant
        const assistant = await assistantService.createAssistant(req.userId, req.body);
        
        if (!assistant) {
            // Silent failure for limit exceeded
            return res.json({
                success: true,
                data: null
            });
        }
        
        res.json({
            success: true,
            data: assistant
        });
    } catch (error) {
        console.error('Error creating assistant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create assistant'
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