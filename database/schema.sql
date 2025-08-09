-- Authentication Setup ONLY
-- Run this in Supabase SQL Editor

-- ========================================
-- USER PROFILE TABLE
-- ========================================
-- Extends Supabase auth with demo user info

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
-- AUTO-CREATE PROFILE FUNCTION
-- ========================================
-- Automatically creates profile when user signs up

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

-- Create trigger for new signups
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- DEMO CLEANUP FUNCTION
-- ========================================
-- Function to clean up expired demo accounts

CREATE OR REPLACE FUNCTION public.cleanup_expired_demos()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
    expired_user RECORD;
BEGIN
    -- Get all expired demo users
    FOR expired_user IN 
        SELECT p.id, p.email 
        FROM public.profiles p
        WHERE p.is_demo_user = true 
        AND p.demo_expires_at < NOW()
    LOOP
        -- Delete user (cascades will handle profile)
        DELETE FROM auth.users WHERE id = expired_user.id;
        expired_count := expired_count + 1;
        
        -- Log the cleanup
        RAISE LOG 'Cleaned up expired demo user: % (ID: %)', expired_user.email, expired_user.id;
    END LOOP;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_demos() TO service_role;

-- ========================================
-- DONE! Auth setup complete
-- ========================================