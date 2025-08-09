const axios = require('axios');

class VAPIService {
    constructor() {
        this.baseUrl = process.env.VAPI_BASE_URL || 'https://api.vapi.ai';
        this.apiKey = process.env.VAPI_API_TOKEN;
    }

    // Create assistant in VAPI
    async createAssistant(payload) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/assistant`,
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
            console.error('VAPI assistant creation error:', error.response?.data || error.message);
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