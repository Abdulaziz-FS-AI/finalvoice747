const axios = require('axios');
const crypto = require('crypto');

class PhoneNumberService {
    constructor(supabaseClient = null) {
        this.supabase = supabaseClient;
        this.vapiBaseUrl = process.env.VAPI_BASE_URL || 'https://api.vapi.ai';
        this.vapiApiKey = process.env.VAPI_API_TOKEN;
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    }

    // Validation methods
    validatePhoneNumber(phoneNumber) {
        // E.164 format validation: +[1-9]\d{1,14}
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        return e164Regex.test(phoneNumber);
    }

    validateTwilioAccountSid(sid) {
        // Twilio Account SID format: AC followed by 32 hex characters
        const twilioSidRegex = /^AC[a-fA-F0-9]{32}$/;
        return twilioSidRegex.test(sid);
    }

    validateTwilioAuthToken(token) {
        // Twilio auth token should be at least 32 characters
        return token && token.length >= 32;
    }

    validateFriendlyName(name) {
        return name && name.trim().length > 0 && name.length <= 255;
    }

    // Encryption methods (for production use)
    encryptCredential(credential) {
        if (!credential) return null;
        
        // Simple encryption - use proper encryption library in production
        const cipher = crypto.createCipher('aes192', this.encryptionKey);
        let encrypted = cipher.update(credential, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decryptCredential(encryptedCredential) {
        if (!encryptedCredential) return null;
        
        try {
            const decipher = crypto.createDecipher('aes192', this.encryptionKey);
            let decrypted = decipher.update(encryptedCredential, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    // VAPI Integration methods
    async createPhoneNumberInVAPI(phoneData) {
        const payload = {
            provider: 'twilio',
            number: phoneData.phoneNumber,
            twilioAccountSid: phoneData.twilioAccountSid,
            twilioAuthToken: phoneData.twilioAuthToken,
            name: phoneData.friendlyName
        };

        // Add assistant if assigned
        if (phoneData.assistantId) {
            // Get VAPI assistant ID from database
            const vapiAssistantId = await this.getVAPIAssistantId(phoneData.assistantId);
            if (vapiAssistantId) {
                payload.assistantId = vapiAssistantId;
            }
        }

        try {
            const response = await axios.post(
                `${this.vapiBaseUrl}/phone-number`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.vapiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                data: {
                    vapiPhoneId: response.data.id,
                    vapiCredentialId: response.data.credentialId
                }
            };
        } catch (error) {
            console.error('VAPI phone number creation error:', error.response?.data || error.message);
            
            let errorMessage = 'Failed to create phone number in VAPI';
            if (error.response?.status === 400) {
                errorMessage = 'Invalid phone number or credentials';
            } else if (error.response?.status === 409) {
                errorMessage = 'Phone number already exists';
            } else if (error.response?.status === 401) {
                errorMessage = 'Invalid VAPI API key';
            }

            return {
                success: false,
                error: errorMessage,
                details: error.response?.data
            };
        }
    }

    async updatePhoneNumberInVAPI(vapiPhoneId, updateData) {
        const payload = {};
        
        if (updateData.friendlyName) {
            payload.name = updateData.friendlyName;
        }
        
        if (updateData.assistantId) {
            const vapiAssistantId = await this.getVAPIAssistantId(updateData.assistantId);
            if (vapiAssistantId) {
                payload.assistantId = vapiAssistantId;
            }
        } else if (updateData.assistantId === null) {
            payload.assistantId = null;
        }

        try {
            const response = await axios.patch(
                `${this.vapiBaseUrl}/phone-number/${vapiPhoneId}`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.vapiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('VAPI phone number update error:', error.response?.data || error.message);
            return {
                success: false,
                error: 'Failed to update phone number in VAPI',
                details: error.response?.data
            };
        }
    }

    async deletePhoneNumberFromVAPI(vapiPhoneId) {
        try {
            await axios.delete(
                `${this.vapiBaseUrl}/phone-number/${vapiPhoneId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.vapiApiKey}`
                    }
                }
            );

            return { success: true };
        } catch (error) {
            console.error('VAPI phone number deletion error:', error.response?.data || error.message);
            return {
                success: false,
                error: 'Failed to delete phone number from VAPI',
                details: error.response?.data
            };
        }
    }

    // Database methods
    async getVAPIAssistantId(assistantId) {
        if (!this.supabase || !assistantId) return null;

        try {
            const { data, error } = await this.supabase
                .from('assistants')
                .select('vapi_assistant_id')
                .eq('id', assistantId)
                .single();

            if (error) {
                console.error('Error fetching assistant VAPI ID:', error);
                return null;
            }

            return data?.vapi_assistant_id;
        } catch (error) {
            console.error('Database error:', error);
            return null;
        }
    }

    async createPhoneNumber(userId, phoneData) {
        // Validation
        const validationErrors = [];
        
        if (!this.validatePhoneNumber(phoneData.phoneNumber)) {
            validationErrors.push('Invalid phone number format. Use E.164 format (e.g., +14155551234)');
        }
        
        if (!this.validateFriendlyName(phoneData.friendlyName)) {
            validationErrors.push('Friendly name is required and must be 1-255 characters');
        }
        
        if (!this.validateTwilioAccountSid(phoneData.twilioAccountSid)) {
            validationErrors.push('Invalid Twilio Account SID format');
        }
        
        if (!this.validateTwilioAuthToken(phoneData.twilioAuthToken)) {
            validationErrors.push('Invalid Twilio Auth Token (must be at least 32 characters)');
        }

        if (validationErrors.length > 0) {
            return {
                success: false,
                error: 'Validation failed',
                details: validationErrors
            };
        }

        // Check for existing phone number
        if (this.supabase) {
            const { data: existing } = await this.supabase
                .from('phone_numbers')
                .select('id')
                .eq('phone_number', phoneData.phoneNumber)
                .single();

            if (existing) {
                return {
                    success: false,
                    error: 'Phone number already exists',
                    code: 'PHONE_EXISTS'
                };
            }
        }

        // Create phone number in VAPI first
        const vapiResult = await this.createPhoneNumberInVAPI(phoneData);
        if (!vapiResult.success) {
            return vapiResult;
        }

        // Store in database
        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('phone_numbers')
                    .insert({
                        user_id: userId,
                        phone_number: phoneData.phoneNumber,
                        friendly_name: phoneData.friendlyName,
                        provider: 'twilio',
                        vapi_phone_id: vapiResult.data.vapiPhoneId,
                        vapi_credential_id: vapiResult.data.vapiCredentialId,
                        twilio_account_sid: phoneData.twilioAccountSid,
                        twilio_auth_token: this.encryptCredential(phoneData.twilioAuthToken),
                        assigned_assistant_id: phoneData.assignedAssistantId || null,
                        notes: phoneData.notes || null,
                        status: 'active'
                    })
                    .select()
                    .single();

                if (error) {
                    // Rollback VAPI creation
                    await this.deletePhoneNumberFromVAPI(vapiResult.data.vapiPhoneId);
                    
                    console.error('Database insertion error:', error);
                    return {
                        success: false,
                        error: 'Failed to save phone number to database'
                    };
                }

                return {
                    success: true,
                    data: {
                        id: data.id,
                        phoneNumber: data.phone_number,
                        friendlyName: data.friendly_name,
                        vapiPhoneId: data.vapi_phone_id,
                        status: data.status,
                        createdAt: data.created_at
                    }
                };
            } catch (error) {
                // Rollback VAPI creation
                await this.deletePhoneNumberFromVAPI(vapiResult.data.vapiPhoneId);
                
                console.error('Database error:', error);
                return {
                    success: false,
                    error: 'Database error occurred'
                };
            }
        } else {
            // Mock response when no database
            return {
                success: true,
                data: {
                    id: 'mock-id',
                    phoneNumber: phoneData.phoneNumber,
                    friendlyName: phoneData.friendlyName,
                    vapiPhoneId: vapiResult.data.vapiPhoneId,
                    status: 'active',
                    createdAt: new Date().toISOString()
                }
            };
        }
    }

    async getPhoneNumbers(userId) {
        if (!this.supabase) {
            // Return mock data when no database
            return {
                success: true,
                data: [
                    {
                        id: '1',
                        phoneNumber: '+14155551234',
                        friendlyName: 'Main Sales Line',
                        provider: 'twilio',
                        vapiPhoneId: 'vapi_123',
                        vapiCredentialId: 'cred_123',
                        twilioAccountSid: 'AC1234567890123456789012345678901234',
                        assignedAssistantId: '1',
                        assignedAssistantName: 'Customer Support Bot',
                        status: 'active',
                        createdAt: '2024-01-15T10:30:00Z',
                        notes: 'Primary customer support line'
                    }
                ]
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('phone_numbers')
                .select(`
                    *,
                    assistants:assigned_assistant_id (
                        id,
                        name,
                        company_name
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching phone numbers:', error);
                return {
                    success: false,
                    error: 'Failed to fetch phone numbers'
                };
            }

            const phoneNumbers = data.map(phone => ({
                id: phone.id,
                phoneNumber: phone.phone_number,
                friendlyName: phone.friendly_name,
                provider: phone.provider,
                vapiPhoneId: phone.vapi_phone_id,
                vapiCredentialId: phone.vapi_credential_id,
                twilioAccountSid: phone.twilio_account_sid,
                assignedAssistantId: phone.assigned_assistant_id,
                assignedAssistantName: phone.assistants?.name || null,
                status: phone.status,
                createdAt: phone.created_at,
                updatedAt: phone.updated_at,
                notes: phone.notes
            }));

            return {
                success: true,
                data: phoneNumbers
            };
        } catch (error) {
            console.error('Database error:', error);
            return {
                success: false,
                error: 'Database error occurred'
            };
        }
    }

    async updatePhoneNumber(userId, phoneId, updateData) {
        if (!this.supabase) {
            // Mock response when no database
            return {
                success: true,
                data: {
                    id: phoneId,
                    ...updateData,
                    updatedAt: new Date().toISOString()
                }
            };
        }

        try {
            // Get existing phone number
            const { data: existing, error: fetchError } = await this.supabase
                .from('phone_numbers')
                .select('*')
                .eq('id', phoneId)
                .eq('user_id', userId)
                .single();

            if (fetchError || !existing) {
                return {
                    success: false,
                    error: 'Phone number not found'
                };
            }

            // Update in VAPI if necessary
            if (updateData.friendlyName || updateData.assignedAssistantId !== undefined) {
                const vapiResult = await this.updatePhoneNumberInVAPI(existing.vapi_phone_id, updateData);
                if (!vapiResult.success) {
                    return vapiResult;
                }
            }

            // Update in database
            const updateFields = {};
            if (updateData.friendlyName) updateFields.friendly_name = updateData.friendlyName;
            if (updateData.assignedAssistantId !== undefined) updateFields.assigned_assistant_id = updateData.assignedAssistantId;
            if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
            updateFields.updated_at = new Date().toISOString();

            const { data, error } = await this.supabase
                .from('phone_numbers')
                .update(updateFields)
                .eq('id', phoneId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Database update error:', error);
                return {
                    success: false,
                    error: 'Failed to update phone number'
                };
            }

            return {
                success: true,
                data: {
                    id: data.id,
                    phoneNumber: data.phone_number,
                    friendlyName: data.friendly_name,
                    assignedAssistantId: data.assigned_assistant_id,
                    notes: data.notes,
                    updatedAt: data.updated_at
                }
            };
        } catch (error) {
            console.error('Update error:', error);
            return {
                success: false,
                error: 'Update operation failed'
            };
        }
    }

    async deletePhoneNumber(userId, phoneId) {
        if (!this.supabase) {
            // Mock response when no database
            return { success: true };
        }

        try {
            // Get existing phone number
            const { data: existing, error: fetchError } = await this.supabase
                .from('phone_numbers')
                .select('vapi_phone_id')
                .eq('id', phoneId)
                .eq('user_id', userId)
                .single();

            if (fetchError || !existing) {
                return {
                    success: false,
                    error: 'Phone number not found'
                };
            }

            // Delete from VAPI first
            const vapiResult = await this.deletePhoneNumberFromVAPI(existing.vapi_phone_id);
            if (!vapiResult.success) {
                console.warn('Failed to delete from VAPI, continuing with database deletion');
            }

            // Delete from database
            const { error } = await this.supabase
                .from('phone_numbers')
                .delete()
                .eq('id', phoneId)
                .eq('user_id', userId);

            if (error) {
                console.error('Database deletion error:', error);
                return {
                    success: false,
                    error: 'Failed to delete phone number from database'
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

    // Utility method to mask phone numbers for logging
    maskPhoneNumber(phoneNumber) {
        if (!phoneNumber || phoneNumber.length < 4) return phoneNumber;
        return phoneNumber.slice(0, -4) + '****';
    }
}

module.exports = PhoneNumberService;