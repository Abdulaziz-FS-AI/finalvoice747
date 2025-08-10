const axios = require('axios');

class VAPIService {
    constructor() {
        this.baseUrl = process.env.VAPI_BASE_URL || 'https://api.vapi.ai';
        this.apiKey = process.env.VAPI_API_TOKEN;
        
        // Log configuration status (without exposing sensitive data)
        console.log('🔧 VAPI Service Configuration:');
        console.log('Base URL:', this.baseUrl);
        console.log('API Key configured:', !!this.apiKey);
        console.log('API Key length:', this.apiKey ? this.apiKey.length : 0);
        
        if (!this.apiKey) {
            console.error('❌ VAPI_API_TOKEN not found in environment variables!');
        }
    }

    // Create assistant in VAPI with retry logic
    async createAssistant(payload, retryCount = 0) {
        // Check if API key is configured
        if (!this.apiKey) {
            console.error('❌ VAPI API Key not configured');
            return null;
        }
        
        // Validate payload
        if (!payload || !payload.name) {
            console.error('❌ Invalid payload - missing required fields');
            return null;
        }
        
        try {
            console.log(`🎯 VAPI CREATE REQUEST (attempt ${retryCount + 1}/3):`);
            console.log('Base URL:', this.baseUrl);
            console.log('API Key exists:', !!this.apiKey);
            console.log('Payload keys:', Object.keys(payload));
            
            const response = await axios.post(
                `${this.baseUrl}/assistant`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log('✅ VAPI SUCCESS:', response.status, response.statusText);
            return response.data;
        } catch (error) {
            const errorDetails = {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                url: `${this.baseUrl}/assistant`,
                apiKeyExists: !!this.apiKey,
                isTimeout: error.code === 'ECONNABORTED'
            };
            
            console.error(`❌ VAPI FAILED (attempt ${retryCount + 1}/3):`, errorDetails);
            
            // Retry on network errors or 5xx errors (not auth errors)
            if (retryCount < 2 && (
                error.code === 'ECONNABORTED' || // Timeout
                error.code === 'ENOTFOUND' ||    // DNS error
                error.code === 'ECONNRESET' ||   // Connection reset
                (error.response?.status >= 500)   // Server errors
            )) {
                console.log(`🔄 Retrying VAPI request in ${(retryCount + 1) * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
                return this.createAssistant(payload, retryCount + 1);
            }
            
            return null;
        }
    }

    // Update assistant in VAPI
    async updateAssistant(assistantId, payload) {
        try {
            const response = await axios.patch(
                `${this.baseUrl}/assistant/${assistantId}`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('VAPI assistant update error:', error.response?.data || error.message);
            return null;
        }
    }

    // Delete assistant from VAPI
    async deleteAssistant(assistantId) {
        try {
            await axios.delete(
                `${this.baseUrl}/assistant/${assistantId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return true;
        } catch (error) {
            console.error('VAPI assistant deletion error:', error.response?.data || error.message);
            return false;
        }
    }

    // Create phone number in VAPI
    async createPhoneNumber(payload) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/phone-number`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('VAPI phone number creation error:', error.response?.data || error.message);
            return null;
        }
    }

    // Update phone number in VAPI
    async updatePhoneNumber(phoneNumberId, payload) {
        try {
            const response = await axios.patch(
                `${this.baseUrl}/phone-number/${phoneNumberId}`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('VAPI phone number update error:', error.response?.data || error.message);
            return null;
        }
    }

    // Delete phone number from VAPI
    async deletePhoneNumber(phoneNumberId) {
        try {
            await axios.delete(
                `${this.baseUrl}/phone-number/${phoneNumberId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return true;
        } catch (error) {
            console.error('VAPI phone number deletion error:', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = new VAPIService();