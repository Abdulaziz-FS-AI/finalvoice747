-- ========================================
-- VOICE MATRIX AI - COMPLETE DATABASE SCHEMA
-- ========================================
-- This is the COMPLETE database setup for Voice Matrix AI SaaS platform
-- Run this ONCE in Supabase SQL Editor to set up the entire database
--
-- Features:
-- - User authentication with demo accounts (7-day expiry)
-- - AI assistant management with 2-assistant limit for demo users
-- - Phone number management (Twilio/VAPI integration)
-- - Call logging with transcripts and analysis
-- - Usage tracking and analytics
-- - Row Level Security (RLS) for data isolation
-- ========================================

-- ========================================
-- PROFILES TABLE - User Management
-- ========================================
-- Extends Supabase auth with demo user functionality

CREATE TABLE public.profiles (
    -- Links to Supabase auth.users table
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    
    -- Basic user info (from auth provider)
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    
    -- Demo-specific fields
    is_demo_user BOOLEAN DEFAULT true,
    demo_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable security so users only see their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- ========================================
-- ASSISTANTS TABLE - AI Assistant Management
-- ========================================
-- Stores AI assistant configurations for each user

CREATE TABLE public.assistants (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user profile (cascade delete when user is deleted)
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Assistant configuration
    name TEXT NOT NULL,
    vapi_assistant_id TEXT UNIQUE, -- ID from VAPI service
    
    -- Assistant settings (stored as JSONB for flexibility)
    configuration JSONB NOT NULL DEFAULT '{}',
    
    -- Usage tracking for call duration
    total_call_duration_seconds INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own assistants
CREATE POLICY "Users can view own assistants" 
ON public.assistants FOR SELECT 
USING (user_id = auth.uid());

-- Policy: Users can insert their own assistants
CREATE POLICY "Users can create own assistants" 
ON public.assistants FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own assistants
CREATE POLICY "Users can update own assistants" 
ON public.assistants FOR UPDATE 
USING (user_id = auth.uid());

-- Policy: Users can delete their own assistants
CREATE POLICY "Users can delete own assistants" 
ON public.assistants FOR DELETE 
USING (user_id = auth.uid());

-- ========================================
-- PHONE NUMBERS TABLE - Phone Number Management
-- ========================================
-- Stores phone numbers assigned to each assistant

CREATE TABLE public.phone_numbers (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links to user (for RLS) and assistant
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    assigned_assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
    
    -- Phone number details (E.164 format: +14155551234)
    phone_number TEXT UNIQUE NOT NULL,
    friendly_name TEXT NOT NULL, -- "Main Sales Line"
    
    -- Provider details
    provider TEXT DEFAULT 'twilio' CHECK (provider IN ('twilio', 'vapi')),
    
    -- VAPI response data
    vapi_phone_id TEXT UNIQUE, -- ID from VAPI service
    vapi_credential_id TEXT,   -- Credential ID from VAPI service
    
    -- Twilio credentials (user provides their own)
    twilio_account_sid TEXT, -- "ACxxxxx..." (32 chars)
    twilio_auth_token TEXT,  -- Should be encrypted in production
    
    -- Optional notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own phone numbers
CREATE POLICY "Users can view own phone numbers" 
ON public.phone_numbers FOR SELECT 
USING (user_id = auth.uid());

-- Policy: Users can insert their own phone numbers
CREATE POLICY "Users can create own phone numbers" 
ON public.phone_numbers FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own phone numbers
CREATE POLICY "Users can update own phone numbers" 
ON public.phone_numbers FOR UPDATE 
USING (user_id = auth.uid());

-- Policy: Users can delete their own phone numbers
CREATE POLICY "Users can delete own phone numbers" 
ON public.phone_numbers FOR DELETE 
USING (user_id = auth.uid());

-- ========================================
-- CALL LOGS TABLE - Call Data & Analytics
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

-- ========================================
-- USER LIMITS TABLE - Usage Tracking
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
    max_assistants INTEGER DEFAULT 2,
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
WITH CHECK (true); -- Allow system to create

-- ========================================
-- USAGE LOGS TABLE - Audit Trail
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
-- CALL ANALYTICS TABLE - Dashboard Data
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
-- PERFORMANCE INDEXES
-- ========================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_demo_expires ON public.profiles(demo_expires_at) WHERE is_demo_user = true;

-- Assistants indexes
CREATE INDEX idx_assistants_user_id ON public.assistants(user_id);
CREATE INDEX idx_assistants_vapi_id ON public.assistants(vapi_assistant_id);

-- Phone numbers indexes
CREATE INDEX idx_phone_numbers_user_id ON public.phone_numbers(user_id);
CREATE INDEX idx_phone_numbers_assistant_id ON public.phone_numbers(assigned_assistant_id);
CREATE INDEX idx_phone_numbers_phone ON public.phone_numbers(phone_number);

-- Call logs indexes
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX idx_call_logs_assistant_id ON public.call_logs(assistant_id);
CREATE INDEX idx_call_logs_phone_number_id ON public.call_logs(phone_number_id);
CREATE INDEX idx_call_logs_started_at ON public.call_logs(started_at);
CREATE INDEX idx_call_logs_vapi_call_id ON public.call_logs(vapi_call_id);
CREATE INDEX idx_call_logs_user_status_duration ON public.call_logs(user_id, status, duration_seconds);

-- User limits indexes
CREATE INDEX idx_user_limits_user_id ON public.user_limits(user_id);
CREATE INDEX idx_user_limits_plan_type ON public.user_limits(plan_type);

-- Usage logs indexes
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_action_type ON public.usage_logs(action_type);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at);

-- Call analytics indexes
CREATE INDEX idx_call_analytics_user_id ON public.call_analytics(user_id);
CREATE INDEX idx_call_analytics_assistant_id ON public.call_analytics(assistant_id);
CREATE INDEX idx_call_analytics_period ON public.call_analytics(period_type, period_start);

-- ========================================
-- DATABASE FUNCTIONS
-- ========================================

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile entry for new user
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail signup
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create user limits when profile is created
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
        2,      -- 2 assistants for free plan
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

-- Update assistant call duration when call ends
CREATE OR REPLACE FUNCTION public.update_assistant_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update when call ends (status changes to completed)
    IF NEW.status = 'completed' AND NEW.duration_seconds IS NOT NULL THEN
        -- Add duration to assistant's total
        UPDATE public.assistants 
        SET 
            total_call_duration_seconds = total_call_duration_seconds + NEW.duration_seconds,
            updated_at = NOW()
        WHERE id = NEW.assistant_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's total call usage (for demo limits)
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

-- Check if user can create assistant (demo limits)
CREATE OR REPLACE FUNCTION public.check_user_assistant_limit(user_uuid UUID)
RETURNS TABLE(
    can_create_assistant BOOLEAN,
    assistant_count INTEGER,
    demo_expired BOOLEAN
) AS $$
DECLARE
    profile_record RECORD;
    assistant_count_val INTEGER;
BEGIN
    -- Get user profile info
    SELECT p.demo_expires_at, p.is_demo_user 
    INTO profile_record
    FROM public.profiles p 
    WHERE p.id = user_uuid;
    
    -- Check if demo expired
    demo_expired := profile_record.demo_expires_at < NOW();
    
    -- Count user assistants
    SELECT COUNT(*) INTO assistant_count_val
    FROM public.assistants a
    WHERE a.user_id = user_uuid;
    
    -- Return results
    can_create_assistant := (assistant_count_val < 2 AND NOT demo_expired);
    assistant_count := assistant_count_val;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync user usage with actual data
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

-- Clean up expired demo accounts
CREATE OR REPLACE FUNCTION public.cleanup_expired_demos()
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
        -- Delete user (cascades will handle all related data)
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

-- ========================================
-- TRIGGERS
-- ========================================

-- Create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create user limits when profile is created
CREATE TRIGGER on_profile_created_create_limits
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.create_user_limits();

-- Update assistant usage when call ends
CREATE TRIGGER update_assistant_on_call_end
    AFTER INSERT OR UPDATE ON public.call_logs
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_assistant_call_duration();

-- ========================================
-- PERMISSIONS
-- ========================================

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION public.get_user_call_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_call_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_user_assistant_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_demos() TO service_role;

-- ========================================
-- SETUP COMPLETE! ✅
-- ========================================
-- 
-- Your Voice Matrix AI database is now ready!
-- 
-- Next steps:
-- 1. Set up environment variables in your app
-- 2. Test user registration and assistant creation
-- 3. Set up VAPI webhooks for call logging
-- 4. Configure cron job for demo cleanup
-- 
-- ========================================