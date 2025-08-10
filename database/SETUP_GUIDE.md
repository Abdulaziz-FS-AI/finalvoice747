# Voice Matrix AI - Complete Supabase Database Setup

## 🚀 Quick Setup Guide

**Run these SQL files IN ORDER in your Supabase SQL Editor:**

### Step 1: Core Authentication (REQUIRED)
```sql
-- File: schema.sql
-- Creates: profiles table, auth triggers, demo cleanup
```

### Step 2: Assistant Functionality (REQUIRED)
```sql
-- File: assistant-schema.sql  
-- Creates: assistants table, RLS policies, limit checking
```

### Step 3: Phone Number Management (REQUIRED)
```sql
-- File: phone-number-schema.sql
-- Creates: phone_numbers table, Twilio/VAPI integration
```

### Step 4: Call Logging & Analytics (REQUIRED)
```sql
-- File: call-logs-schema.sql
-- Creates: call_logs table, usage tracking, webhook support
```

### Step 5: Missing Tables (CRITICAL - NEW!)
```sql
-- File: missing-tables-schema.sql
-- Creates: user_limits, usage_logs, call_analytics tables
-- These are REQUIRED for the current codebase to work!
```

## ⚠️ CRITICAL ISSUE FOUND!

Your current SQL schema was **MISSING 3 ESSENTIAL TABLES** that the codebase requires:

### Missing Tables:
1. **`user_limits`** - Tracks user usage limits (required by user-limits.service.js)
2. **`usage_logs`** - Audit trail for all user actions (required by user-limits.service.js)  
3. **`call_analytics`** - Dashboard analytics data (required by call-analytics.service.js)

### Impact:
- ❌ **Usage dashboard won't work** without `user_limits` table
- ❌ **Usage history won't load** without `usage_logs` table  
- ❌ **Analytics dashboard will fail** without `call_analytics` table
- ❌ **User limit checking will fail** causing 500 errors

## 🔧 Setup Instructions

### Option A: Fresh Setup (Recommended)
1. Go to your Supabase project → SQL Editor
2. Run each file in order (1-5 above)
3. Verify all tables exist in Table Editor

### Option B: Add Missing Tables Only
1. Go to your Supabase project → SQL Editor  
2. Run **only** `missing-tables-schema.sql`
3. This adds the 3 missing tables to your existing setup

## ✅ Verification Checklist

After setup, verify these tables exist in your Supabase:

**Core Tables:**
- [ ] `profiles` (user authentication)
- [ ] `assistants` (AI assistant configs)  
- [ ] `phone_numbers` (Twilio integration)
- [ ] `call_logs` (call history)

**Missing Tables (CRITICAL):**
- [ ] `user_limits` (usage tracking)
- [ ] `usage_logs` (audit trail)
- [ ] `call_analytics` (dashboard data)

## 🛠️ Table Relationships

```
profiles (users)
├── assistants (1:many)
├── phone_numbers (1:many) 
├── call_logs (1:many)
├── user_limits (1:1) ← MISSING
├── usage_logs (1:many) ← MISSING
└── call_analytics (1:many) ← MISSING
```

## 🚨 Production Notes

- All tables have **Row Level Security (RLS)** enabled
- Users can only access their own data
- System/service role can manage webhooks and analytics
- Demo accounts auto-expire after 7 days or 10 minutes of calls
- All foreign keys cascade properly on user deletion

## 📊 Why These Tables Are Critical

### `user_limits` Table:
- Stores per-user limits (1 assistant, 10 minutes for free plan)
- Tracks current usage against limits
- Required for "/api/user/limits" endpoint
- Without this: Usage dashboard shows errors

### `usage_logs` Table:  
- Records every user action (create assistant, delete, calls)
- Provides audit trail and usage history
- Required for "/api/user/usage-history" endpoint
- Without this: Usage history page is empty

### `call_analytics` Table:
- Aggregated analytics for dashboard charts
- Call success rates, duration trends
- Required for "/api/analytics/dashboard" endpoint  
- Without this: Analytics dashboard fails

## 🎯 Next Steps

1. **Run the missing-tables-schema.sql IMMEDIATELY**
2. Test the usage dashboard - it should now work
3. Test creating assistants - limits should be properly enforced
4. Check analytics - dashboard should load data

Your project will work perfectly once these missing tables are added! 🔥