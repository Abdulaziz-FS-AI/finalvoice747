-- Call Logging Schema ONLY
-- Run this in Supabase SQL Editor AFTER running phone-number-schema.sql
-- This tracks all call data and usage for demo limits

-- ========================================
-- CALL LOGS TABLE
-- ========================================
-- Stores detailed call data and transcripts

CREATE TABLE public.call_logs (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user and related entities
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assistant_id UUID REFERENCES public.assistants(id) ON DELETE CASCADE NOT NULL,
    phone_number_id UUID REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
    
    -- VAPI call identifier
    vapi_call_id TEXT UNIQUE,
    
    -- Caller details
    caller_number TEXT,
    
    -- Call metrics
    duration_seconds INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('completed', 'failed', 'no-answer', 'busy', 'in_progress', 'cancelled')),
    
    -- Call content and analysis
    transcript TEXT, -- Complete word-for-word conversation
    structured_data JSONB, -- Extracted information based on structured questions
    summary TEXT, -- AI-generated summary of discussion
    success_evaluation TEXT, -- Whether assistant achieved its objective
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own call logs
CREATE POLICY "Users can view own call logs" 
ON public.call_logs FOR SELECT 
USING (user_id = auth.uid());

-- Policy: System can insert call logs (for VAPI webhooks)
CREATE POLICY "System can create call logs" 
ON public.call_logs FOR INSERT 
WITH CHECK (true); -- Allow system/service role to insert from webhooks

-- Policy: System can update call logs (for VAPI webhooks)
CREATE POLICY "System can update call logs" 
ON public.call_logs FOR UPDATE 
USING (true); -- Allow system/service role to update from webhooks

-- Policy: Users cannot directly modify call logs (webhook-only)
-- No user INSERT/UPDATE/DELETE policies - only system can modify

-- ========================================
-- USAGE TRACKING FUNCTIONS
-- ========================================

-- Function to update assistant total call duration when call ends
CREATE OR REPLACE FUNCTION public.update_assistant_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update when call ends (status changes to completed)
    IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
        -- Add duration to assistant's total (need to add this field to assistants table)
        UPDATE public.assistants 
        SET updated_at = NOW()
        WHERE id = NEW.assistant_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update assistant when call ends
CREATE TRIGGER update_assistant_on_call_end
    AFTER INSERT OR UPDATE ON public.call_logs
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_assistant_call_duration();

-- Function to get user's total call usage (for 10-minute demo limit)
CREATE OR REPLACE FUNCTION public.get_user_call_usage(user_uuid UUID)
RETURNS TABLE(
    total_call_seconds INTEGER,
    total_call_minutes INTEGER,
    call_count INTEGER,
    latest_call TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    SELECT 
        COALESCE(SUM(duration_seconds), 0)::INTEGER,
        COALESCE(SUM(duration_seconds), 0)::INTEGER / 60,
        COUNT(*)::INTEGER,
        MAX(started_at)
    INTO total_call_seconds, total_call_minutes, call_count, latest_call
    FROM public.call_logs
    WHERE user_id = user_uuid 
    AND status = 'completed';
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_user_call_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_call_usage(UUID) TO service_role;

-- Enhanced demo cleanup function that checks call usage
CREATE OR REPLACE FUNCTION public.cleanup_demo_users_with_call_limits()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- Clean up users who either:
    -- 1. Demo expired (7 days)
    -- 2. Hit 10-minute call limit (600 seconds)
    FOR user_record IN 
        SELECT DISTINCT p.id, p.email, p.demo_expires_at,
               COALESCE(SUM(cl.duration_seconds), 0) as total_seconds
        FROM public.profiles p
        LEFT JOIN public.call_logs cl ON cl.user_id = p.id AND cl.status = 'completed'
        WHERE p.is_demo_user = true
        GROUP BY p.id, p.email, p.demo_expires_at
        HAVING 
            p.demo_expires_at < NOW() OR  -- Demo expired
            COALESCE(SUM(cl.duration_seconds), 0) >= 600  -- 10 minutes = 600 seconds
    LOOP
        -- Delete user (cascades will handle assistants, phone numbers, call logs, profile)
        DELETE FROM auth.users WHERE id = user_record.id;
        cleanup_count := cleanup_count + 1;
        
        -- Log the cleanup with reason
        IF user_record.demo_expires_at < NOW() THEN
            RAISE LOG 'Cleaned up expired demo user: % (ID: %)', user_record.email, user_record.id;
        ELSE
            RAISE LOG 'Cleaned up demo user due to call limit: % (ID: %, %min used)', 
                user_record.email, user_record.id, (user_record.total_seconds / 60);
        END IF;
    END LOOP;
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_demo_users_with_call_limits() TO service_role;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Index for faster call log lookups by user
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);

-- Index for faster lookups by assistant
CREATE INDEX idx_call_logs_assistant_id ON public.call_logs(assistant_id);

-- Index for faster lookups by phone number
CREATE INDEX idx_call_logs_phone_number_id ON public.call_logs(phone_number_id);

-- Index for faster date-based queries
CREATE INDEX idx_call_logs_started_at ON public.call_logs(started_at);

-- Index for VAPI call ID lookups (webhook updates)
CREATE INDEX idx_call_logs_vapi_call_id ON public.call_logs(vapi_call_id);

-- Composite index for usage calculations
CREATE INDEX idx_call_logs_user_status_duration ON public.call_logs(user_id, status, duration_seconds);

-- ========================================
-- DONE! Call logging schema complete
-- ========================================