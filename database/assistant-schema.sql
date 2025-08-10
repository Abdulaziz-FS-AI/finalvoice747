-- Assistant Creation Schema ONLY
-- Run this in Supabase SQL Editor AFTER running the auth schema.sql
-- This extends the auth system with assistant functionality

-- ========================================
-- ASSISTANTS TABLE
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
    
    -- Usage tracking for 10-minute demo limit
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
-- DEMO LIMIT FUNCTION
-- ========================================
-- Function to check if user can create assistant (1 maximum)

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

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_assistant_limit(UUID) TO authenticated;

-- ========================================
-- INDEX FOR PERFORMANCE
-- ========================================

-- Index for faster assistant lookups by user
CREATE INDEX idx_assistants_user_id ON public.assistants(user_id);

-- ========================================
-- DONE! Assistant creation schema complete
-- ========================================