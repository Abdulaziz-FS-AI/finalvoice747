-- Missing Tables Schema for Voice Matrix AI
-- Run this in Supabase SQL Editor AFTER running all other schema files
-- This adds the missing tables that the project services require

-- ========================================
-- USER LIMITS TABLE
-- ========================================
-- Tracks user usage limits and current consumption

CREATE TABLE public.user_limits (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user profile
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Plan configuration
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'business', 'enterprise')),
    
    -- Limits (max allowed)
    max_assistants INTEGER DEFAULT 1,
    max_call_time_seconds INTEGER DEFAULT 600, -- 10 minutes for free plan
    
    -- Current usage
    current_assistants INTEGER DEFAULT 0,
    used_call_time_seconds INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own limits
CREATE POLICY "Users can view own limits" 
ON public.user_limits FOR SELECT 
USING (user_id = auth.uid());

-- Policy: Users can update their own limits (for usage tracking)
CREATE POLICY "Users can update own limits" 
ON public.user_limits FOR UPDATE 
USING (user_id = auth.uid());

-- Policy: System can insert limits (when user signs up)
CREATE POLICY "System can create limits" 
ON public.user_limits FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- ========================================
-- USAGE LOGS TABLE
-- ========================================
-- Tracks all user actions for audit and analytics

CREATE TABLE public.usage_logs (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Action details
    action_type TEXT NOT NULL, -- 'assistant_created', 'assistant_deleted', 'call_completed', etc.
    resource_id TEXT, -- ID of the resource affected (assistant_id, call_id, etc.)
    
    -- Usage changes
    assistant_count_change INTEGER DEFAULT 0, -- +1 for create, -1 for delete
    call_time_change_seconds INTEGER DEFAULT 0, -- seconds used/released
    
    -- Context
    trigger_reason TEXT, -- 'user_action', 'auto_delete', 'limit_exceeded', etc.
    details JSONB, -- Additional context data
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own usage logs
CREATE POLICY "Users can view own usage logs" 
ON public.usage_logs FOR SELECT 
USING (user_id = auth.uid());

-- Policy: System can insert usage logs
CREATE POLICY "System can create usage logs" 
ON public.usage_logs FOR INSERT 
WITH CHECK (true); -- Allow system/service role to insert

-- ========================================
-- CALL ANALYTICS TABLE (Enhanced)
-- ========================================
-- Stores aggregated analytics data for dashboard

CREATE TABLE public.call_analytics (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user and assistant
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assistant_id UUID REFERENCES public.assistants(id) ON DELETE CASCADE,
    
    -- Time period (daily, weekly, monthly aggregation)
    period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Call metrics
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    average_duration_seconds INTEGER DEFAULT 0,
    
    -- Success metrics
    conversion_rate DECIMAL(5,2) DEFAULT 0.0, -- Percentage of successful calls
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.call_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own analytics
CREATE POLICY "Users can view own analytics" 
ON public.call_analytics FOR SELECT 
USING (user_id = auth.uid());

-- Policy: System can insert/update analytics
CREATE POLICY "System can manage analytics" 
ON public.call_analytics FOR ALL 
USING (true); -- Allow system/service role to manage

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- User limits indexes
CREATE INDEX idx_user_limits_user_id ON public.user_limits(user_id);
CREATE INDEX idx_user_limits_plan_type ON public.user_limits(plan_type);

-- Usage logs indexes
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_action_type ON public.usage_logs(action_type);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at);
CREATE INDEX idx_usage_logs_user_created ON public.usage_logs(user_id, created_at);

-- Call analytics indexes
CREATE INDEX idx_call_analytics_user_id ON public.call_analytics(user_id);
CREATE INDEX idx_call_analytics_assistant_id ON public.call_analytics(assistant_id);
CREATE INDEX idx_call_analytics_period ON public.call_analytics(period_type, period_start);
CREATE INDEX idx_call_analytics_user_period ON public.call_analytics(user_id, period_start);

-- ========================================
-- AUTO-CREATE USER LIMITS FUNCTION
-- ========================================
-- Automatically creates user limits when profile is created

CREATE OR REPLACE FUNCTION public.create_user_limits() 
RETURNS TRIGGER AS $$
BEGIN
    -- Create user limits entry for new profile
    INSERT INTO public.user_limits (
        user_id,
        plan_type,
        max_assistants,
        max_call_time_seconds,
        current_assistants,
        used_call_time_seconds
    ) VALUES (
        NEW.id,
        'free', -- Default to free plan
        1,      -- 1 assistant for free plan
        600,    -- 10 minutes for free plan
        0,      -- Start with 0 assistants
        0       -- Start with 0 usage
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail profile creation
        RAISE LOG 'Error in create_user_limits: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create user limits when profile is created
CREATE TRIGGER on_profile_created_create_limits
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_user_limits();

-- ========================================
-- ENHANCED FUNCTIONS
-- ========================================

-- Function to sync current usage with actual data
CREATE OR REPLACE FUNCTION public.sync_user_usage(user_uuid UUID)
RETURNS TABLE(
    assistants_count INTEGER,
    total_call_seconds INTEGER
) AS $$
DECLARE
    actual_assistants INTEGER;
    actual_call_time INTEGER;
BEGIN
    -- Count actual assistants
    SELECT COUNT(*) INTO actual_assistants
    FROM public.assistants
    WHERE user_id = user_uuid;
    
    -- Sum actual call time from completed calls
    SELECT COALESCE(SUM(duration_seconds), 0) INTO actual_call_time
    FROM public.call_logs
    WHERE user_id = user_uuid 
    AND status = 'completed';
    
    -- Update user_limits with actual values
    UPDATE public.user_limits
    SET 
        current_assistants = actual_assistants,
        used_call_time_seconds = actual_call_time,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    -- Return the synced values
    assistants_count := actual_assistants;
    total_call_seconds := actual_call_time;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.sync_user_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_usage(UUID) TO service_role;

-- ========================================
-- DONE! Missing tables schema complete
-- 
-- INSTALLATION ORDER:
-- 1. schema.sql (profiles and auth)
-- 2. assistant-schema.sql 
-- 3. phone-number-schema.sql
-- 4. call-logs-schema.sql
-- 5. missing-tables-schema.sql (this file)
-- ========================================