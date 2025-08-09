const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const PhoneNumberService = require('../../services/phone-number.service');
const { supabase } = require('../../services/supabase.service');

// Initialize service
const phoneNumberService = new PhoneNumberService(supabase);

// GET /api/phone-numbers - Get all phone numbers for user
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await phoneNumberService.getPhoneNumbers(req.userId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error fetching phone numbers:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/phone-numbers - Create new phone number
router.post('/', requireAuth, async (req, res) => {
    try {
        const phoneData = {
            phoneNumber: req.body.phoneNumber,
            friendlyName: req.body.friendlyName,
            twilioAccountSid: req.body.twilioAccountSid,
            twilioAuthToken: req.body.twilioAuthToken,
            assignedAssistantId: req.body.assignedAssistantId || null,
            notes: req.body.notes || null
        };
        
        const result = await phoneNumberService.createPhoneNumber(req.userId, phoneData);
        
        if (result.success) {
            res.json(result);
        } else {
            const statusCode = result.code === 'PHONE_EXISTS' ? 409 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        console.error('Error creating phone number:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// PATCH /api/phone-numbers/:id - Update phone number
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const updateData = {
            friendlyName: req.body.friendlyName,
            assignedAssistantId: req.body.assignedAssistantId,
            notes: req.body.notes
        };
        
        const result = await phoneNumberService.updatePhoneNumber(req.userId, req.params.id, updateData);
        
        if (result.success) {
            res.json(result);
        } else {
            const statusCode = result.error === 'Phone number not found' ? 404 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        console.error('Error updating phone number:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// DELETE /api/phone-numbers/:id - Delete phone number
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const result = await phoneNumberService.deletePhoneNumber(req.userId, req.params.id);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Phone number deleted successfully'
            });
        } else {
            const statusCode = result.error === 'Phone number not found' ? 404 : 400;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        console.error('Error deleting phone number:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/phone-numbers/:id - Get specific phone number
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const result = await phoneNumberService.getPhoneNumbers(req.userId);
        
        if (result.success) {
            const phoneNumber = result.data.find(p => p.id === req.params.id);
            if (phoneNumber) {
                res.json({
                    success: true,
                    data: phoneNumber
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Phone number not found'
                });
            }
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Error fetching phone number:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;