-- Phone Number Schema ONLY
-- Run this in Supabase SQL Editor AFTER running the assistant-schema.sql
-- This adds phone number functionality to assistants

-- ========================================
-- PHONE NUMBERS TABLE
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
-- INDEX FOR PERFORMANCE
-- ========================================

-- Index for faster phone number lookups by user
CREATE INDEX idx_phone_numbers_user_id ON public.phone_numbers(user_id);

-- Index for faster lookups by assistant
CREATE INDEX idx_phone_numbers_assistant_id ON public.phone_numbers(assigned_assistant_id);

-- ========================================
-- DONE! Phone number schema complete
-- ========================================
