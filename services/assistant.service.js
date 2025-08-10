// Assistant Service
// This service handles all assistant-related operations with Supabase

const { supabase } = require('./supabase.service');
const vapiService = require('./vapi.service');

class AssistantService {
    // Check if user can create assistant (demo limits)
    async canCreateAssistant(userId) {
        try {
            // First check if user profile exists and get basic info
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_demo_user, demo_expires_at')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                console.error('Error getting user profile:', profileError);
                // If profile doesn't exist, allow creation (might be first-time user)
                console.log('Profile not found, allowing assistant creation for new user');
                return {
                    can_create_assistant: true,
                    assistant_count: 0,
                    demo_expired: false,
                    reason: 'new_user'
                };
            }
            
            // Check if demo account expired
            const now = new Date();
            const demoExpired = profile.is_demo_user && 
                profile.demo_expires_at && 
                new Date(profile.demo_expires_at) < now;
            
            if (demoExpired) {
                console.log('Demo account expired for user:', userId);
                return {
                    can_create_assistant: false,
                    assistant_count: 0,
                    demo_expired: true,
                    reason: 'demo_expired'
                };
            }
            
            // Count current assistants
            const { data: assistants, error: countError } = await supabase
                .from('assistants')
                .select('id')
                .eq('user_id', userId);
            
            if (countError) {
                console.error('Error counting assistants:', countError);
                // On error, be conservative and don't allow creation
                return {
                    can_create_assistant: false,
                    assistant_count: 0,
                    demo_expired: false,
                    reason: 'count_error'
                };
            }
            
            const assistantCount = assistants ? assistants.length : 0;
            const maxAssistants = profile.is_demo_user ? 2 : 10; // Demo users get 2, others get 10
            
            const canCreate = assistantCount < maxAssistants;
            
            console.log(`User ${userId} assistant limit check:`, {
                assistantCount,
                maxAssistants,
                canCreate,
                isDemoUser: profile.is_demo_user,
                demoExpired
            });
            
            return {
                can_create_assistant: canCreate,
                assistant_count: assistantCount,
                demo_expired: demoExpired,
                max_assistants: maxAssistants,
                reason: canCreate ? 'allowed' : 'limit_reached'
            };
            
        } catch (error) {
            console.error('Error checking assistant limit:', error);
            // On unexpected error, allow creation to avoid blocking users
            console.log('Unexpected error, allowing assistant creation');
            return {
                can_create_assistant: true,
                assistant_count: 0,
                demo_expired: false,
                reason: 'error_fallback'
            };
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
    
    // Build dynamic system prompt based on personality and questions
    buildSystemPrompt(formData) {
        const personalityTraits = Array.isArray(formData.personality_traits) 
            ? formData.personality_traits 
            : (formData.personality_traits ? [formData.personality_traits] : ['professional', 'friendly']);
        
        // Build personality-specific instructions
        const personalityInstructions = this.buildPersonalityInstructions(personalityTraits);
        
        // Build question-specific instructions - prioritize early asking for short calls
        let questionInstructions = '';
        if (formData.structured_questions && formData.structured_questions.length > 0) {
            questionInstructions = this.buildQuestionInstructions(formData.structured_questions);
        }
        
        // Build evaluation instructions
        let evaluationInstructions = '';
        if (formData.evaluation_method && formData.evaluation_method !== 'NoEvaluation') {
            evaluationInstructions = this.buildEvaluationInstructions(formData.evaluation_method);
        }
        
        // Combine all parts into comprehensive system prompt
        const systemPrompt = `You are a professional AI phone assistant for a business. ${personalityInstructions}

CRITICAL: This is a SHORT CALL (limited time). You MUST ask essential questions within the first 30 seconds after greeting.

${questionInstructions}

CALL OBJECTIVES:
- Gather required information IMMEDIATELY after greeting
- Provide excellent customer service efficiently  
- Maintain a natural, conversational flow
- End calls professionally when objectives are met

CONVERSATION FLOW (STRICT ORDER):
1. Warm greeting (5-10 seconds)
2. IMMEDIATELY ask required questions (next 20-30 seconds)
3. Address caller's needs/concerns
4. Confirm collected information
5. Professional closing

CONVERSATION GUIDELINES:
- Greet warmly but briefly
- Transition quickly to information gathering
- Ask questions directly but politely
- Don't wait for natural openings - create them
- Confirm important information by repeating it back
- Keep responses concise and focused
- Use natural speech patterns but stay efficient

${evaluationInstructions}

IMPORTANT: Time is limited! Prioritize getting required information over lengthy conversations. Ask essential questions early and often.`;
        
        return systemPrompt;
    }
    
    // Build personality-specific behavioral instructions
    buildPersonalityInstructions(traits) {
        const personalityMap = {
            'Professional': 'Maintain a business-like tone while being warm and approachable. Use clear, direct language.',
            'Friendly': 'Be warm, welcoming, and personable. Use a conversational tone that makes callers feel comfortable.',
            'Energetic': 'Speak with enthusiasm and positive energy. Be upbeat and engaging throughout the conversation.',
            'Calming': 'Use a soothing, measured tone. Help anxious callers feel at ease with your peaceful presence.',
            'Confident': 'Speak with authority and certainty. Demonstrate expertise and competence in your responses.',
            'Empathetic': 'Show genuine understanding and compassion. Acknowledge caller emotions and concerns.',
            'Witty': 'Use appropriate humor and clever responses when suitable. Keep the mood light and engaging.',
            'Patient': 'Never rush callers. Take time to explain things clearly and repeat information when needed.',
            'Knowledgeable': 'Demonstrate expertise and provide detailed, accurate information when appropriate.',
            'Supportive': 'Be encouraging and helpful. Focus on solutions and positive outcomes.'
        };
        
        const instructions = traits
            .map(trait => personalityMap[trait])
            .filter(instruction => instruction)
            .join(' ');
        
        return instructions || 'Be professional, friendly, and helpful in all interactions.';
    }
    
    // Build dynamic question instructions - optimized for short calls
    buildQuestionInstructions(questions) {
        if (!questions || questions.length === 0) return '';
        
        const requiredQuestions = questions.filter(q => q.required);
        const optionalQuestions = questions.filter(q => !q.required);
        
        let instructions = 'INFORMATION COLLECTION (SHORT CALL STRATEGY):\n';
        
        if (requiredQuestions.length > 0) {
            instructions += 'REQUIRED INFORMATION (ASK IMMEDIATELY AFTER GREETING - FIRST 30 SECONDS):\n';
            requiredQuestions.forEach((q, index) => {
                const purpose = q.description ? ` (${q.description})` : '';
                instructions += `${index + 1}. "${q.question}"${purpose}\n`;
            });
            
            instructions += '\nSCRIPT EXAMPLE FOR REQUIRED QUESTIONS:\n';
            instructions += '"Hello! Thanks for calling. To help you better, I need to quickly get some information. ';
            if (requiredQuestions.length === 1) {
                instructions += `${requiredQuestions[0].question}"`;
            } else {
                instructions += `First, ${requiredQuestions[0].question.toLowerCase()} And then, ${requiredQuestions[1]?.question?.toLowerCase() || 'your contact information'}"`;
            }
        }
        
        if (optionalQuestions.length > 0) {
            instructions += '\n\nOPTIONAL INFORMATION (only if time permits after required info):\n';
            optionalQuestions.forEach((q, index) => {
                const purpose = q.description ? ` (${q.description})` : '';
                instructions += `${index + 1}. "${q.question}"${purpose}\n`;
            });
        }
        
        instructions += `

QUESTION STRATEGY FOR SHORT CALLS:
- Ask required questions IMMEDIATELY after "Hello, thanks for calling"
- Use transition phrases: "To help you better, I need to quickly get..."  
- Don't wait for conversation to naturally lead to questions
- Ask 2-3 required questions in rapid succession if needed
- Use phrases like "Let me just get your..." to make it feel efficient
- If caller tries to explain their issue first, say "I'll help with that right after I get your [required info]"
- For hesitant callers: "This will just take 10 seconds so I can better assist you"`;
        
        return instructions;
    }
    
    // Build evaluation-specific instructions
    buildEvaluationInstructions(evaluationMethod) {
        const evaluationMap = {
            'NumericScale': '\nCALL SUCCESS METRICS:\nAim for high-quality interactions that would rate 8-10 on a satisfaction scale. Focus on resolution, clarity, and caller satisfaction.',
            'DescriptiveScale': '\nCALL SUCCESS METRICS:\nStrive for "Excellent" interactions by being thorough, helpful, and professional throughout the call.',
            'Checklist': '\nCALL SUCCESS METRICS:\nEnsure all objectives are met systematically. Check off each goal as you accomplish it during the conversation.',
            'BinaryEvaluation': '\nCALL SUCCESS METRICS:\nFocus on achieving a clear successful outcome. Either fully accomplish the call objectives or clearly explain why objectives cannot be met.'
        };
        
        return evaluationMap[evaluationMethod] || '';
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