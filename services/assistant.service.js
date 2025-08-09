// Assistant Service
// This service handles all assistant-related operations with Supabase

const { supabase } = require('./supabase.service');
const vapiService = require('./vapi.service');

class AssistantService {
    // Check if user can create assistant (demo limits)
    async canCreateAssistant(userId) {
        try {
            const { data, error } = await supabase
                .rpc('check_user_assistant_limit', { user_uuid: userId });
                
            if (error) throw error;
            
            return data[0];
        } catch (error) {
            console.error('Error checking assistant limit:', error);
            return { can_create_assistant: false };
        }
    }
    
    // Get all assistants for a user
    async getAssistants(userId) {
        try {
            const { data, error } = await supabase
                .from('assistants')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error getting assistants:', error);
            return [];
        }
    }
    
    // Get a specific assistant
    async getAssistant(assistantId, userId) {
        try {
            const { data, error } = await supabase
                .from('assistants')
                .select('*')
                .eq('id', assistantId)
                .eq('user_id', userId)
                .single();
                
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('Error getting assistant:', error);
            return null;
        }
    }
    
    // Create a new assistant
    async createAssistant(userId, assistantData) {
        try {
            // Check limits first
            const limits = await this.canCreateAssistant(userId);
            if (!limits.can_create_assistant) {
                // Silent failure - return null
                return null;
            }
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(assistantData);
            
            // Build VAPI payload
            const vapiPayload = this.buildVAPIPayload(assistantData, systemPrompt);
            
            // Create in VAPI first
            const vapiAssistant = await vapiService.createAssistant(vapiPayload);
            if (!vapiAssistant) {
                throw new Error('Failed to create VAPI assistant');
            }
            
            // Store in database
            const { data, error } = await supabase
                .from('assistants')
                .insert({
                    user_id: userId,
                    name: assistantData.name,
                    vapi_assistant_id: vapiAssistant.id,
                    configuration: assistantData
                })
                .select()
                .single();
                
            if (error) {
                // Rollback VAPI creation
                await vapiService.deleteAssistant(vapiAssistant.id);
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error creating assistant:', error);
            return null;
        }
    }
    
    // Delete an assistant
    async deleteAssistant(assistantId, userId) {
        try {
            // Get assistant first to get VAPI ID
            const assistant = await this.getAssistant(assistantId, userId);
            if (!assistant) {
                return false;
            }
            
            // Delete from VAPI first
            if (assistant.vapi_assistant_id) {
                await vapiService.deleteAssistant(assistant.vapi_assistant_id);
            }
            
            // Delete from database (cascades will handle related data)
            const { error } = await supabase
                .from('assistants')
                .delete()
                .eq('id', assistantId)
                .eq('user_id', userId);
                
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error deleting assistant:', error);
            return false;
        }
    }
    
    // Get user's total call usage
    async getUserCallUsage(userId) {
        try {
            const { data, error } = await supabase
                .rpc('get_user_call_usage', { user_uuid: userId });
                
            if (error) throw error;
            
            return data[0] || {
                total_call_seconds: 0,
                total_call_minutes: 0,
                call_count: 0,
                latest_call: null
            };
        } catch (error) {
            console.error('Error getting call usage:', error);
            return null;
        }
    }
    
    // Build system prompt (no company name for demo)
    buildSystemPrompt(formData) {
        const personalityText = Array.isArray(formData.personality_traits) 
            ? formData.personality_traits.join(', ') 
            : formData.personality_traits || 'professional and friendly';
        
        let structuredQuestionsInstructions = '';
        if (formData.structured_questions && formData.structured_questions.length > 0) {
            const questions = formData.structured_questions.map(q => `- ${q.question}`).join('\n');
            structuredQuestionsInstructions = `\n\nDuring the conversation, please ask the following questions and collect the responses:\n${questions}`;
        }
        
        return `You are an AI assistant. Your personality should be ${personalityText}.${structuredQuestionsInstructions}`;
    }
    
    // Build structured data schema
    buildStructuredDataSchema(structuredQuestions) {
        if (!structuredQuestions || structuredQuestions.length === 0) {
            return null;
        }
        
        const properties = {};
        const required = [];
        
        structuredQuestions.forEach(q => {
            const fieldName = q.field_name || q.question.toLowerCase().replace(/[^a-z0-9]/g, '_');
            properties[fieldName] = {
                type: q.type || 'string',
                description: q.description || q.question
            };
            
            if (q.required) {
                required.push(fieldName);
            }
        });
        
        return {
            type: 'object',
            properties,
            required,
            description: 'Structured data extracted from the conversation'
        };
    }
    
    // Build VAPI payload
    buildVAPIPayload(formData, systemPrompt) {
        const payload = {
            name: formData.name,
            model: {
                provider: "openai",
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    }
                ],
                maxTokens: 500,
                temperature: 0.7
            },
            voice: {
                provider: "vapi",
                voiceId: formData.voice_id || "Elliot"
            },
            transcriber: {
                provider: "deepgram",
                model: "nova-3-general",
                language: "en"
            },
            firstMessage: formData.first_message,
            firstMessageMode: "assistant-speaks-first",
            maxDurationSeconds: formData.max_call_duration || 300,
            backgroundSound: formData.background_sound || "office",
            recordingEnabled: true,
            fillersEnabled: true,
            endCallFunctionEnabled: false,
            dialKeypadFunctionEnabled: false,
            silenceTimeoutSeconds: 30,
            responseDelaySeconds: 0.4,
            endCallMessage: "Thank you for calling! Have a great day!"
        };

        // Add analysis plan if needed
        const structuredDataSchema = this.buildStructuredDataSchema(formData.structured_questions);
        if (structuredDataSchema || formData.evaluation_method !== 'NoEvaluation') {
            payload.analysisPlan = {
                minMessagesThreshold: 2,
                summaryPlan: {
                    enabled: true,
                    timeoutSeconds: 30
                }
            };

            if (structuredDataSchema) {
                payload.analysisPlan.structuredDataPlan = {
                    enabled: true,
                    schema: structuredDataSchema,
                    timeoutSeconds: 30
                };
            }

            if (formData.evaluation_method && formData.evaluation_method !== 'NoEvaluation') {
                payload.analysisPlan.successEvaluationPlan = {
                    rubric: formData.evaluation_method,
                    enabled: true,
                    timeoutSeconds: 30
                };
            }
        }

        // Add Make.com webhook configuration for call events
        if (process.env.MAKE_WEBHOOK_URL) {
            payload.server = {
                url: process.env.MAKE_WEBHOOK_URL,
                secret: process.env.MAKE_WEBHOOK_SECRET,
                headers: {
                    "Content-Type": "application/json",
                    "x-make-apikey": process.env.MAKE_WEBHOOK_SECRET
                }
            };
            payload.serverMessages = ["end-of-call-report"];
            payload.clientMessages = ["transcript"];
        }

        return payload;
    }
}

module.exports = new AssistantService();