# 🚀 Voice Matrix AI - Complete Setup Guide

## Overview
Voice Matrix AI is a SaaS platform that creates AI-powered voice assistants using VAPI integration and Supabase backend.

## 📋 Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- VAPI account with API key
- Git installed

## 🗄️ Database Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create account
2. Create a new project
3. Wait for project to initialize (2-3 minutes)

### 2. Run Database Schema
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the sidebar
3. Create a new query
4. Copy and paste the **entire contents** of `database/complete-schema.sql`
5. Click "Run" to execute the schema
6. Verify tables were created in "Table Editor"

### 3. Get Database Credentials
From your Supabase project settings:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ Keep secret!

## 🎤 VAPI Setup

### 1. Create VAPI Account
1. Go to [vapi.ai](https://vapi.ai) and sign up
2. Complete onboarding process
3. Go to dashboard

### 2. Get VAPI API Key
1. In VAPI dashboard, go to "API Keys"
2. Create a new API key
3. Copy the key (format: `d5301aff-322f-4699-8d10-64b8328e6a54`)

## ⚙️ Environment Configuration

### 1. Create Environment File
Create `.env` file in project root:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# VAPI Configuration  
VAPI_API_TOKEN=your-vapi-api-key-here
VAPI_BASE_URL=https://api.vapi.ai

# Server Configuration
PORT=8080
NODE_ENV=production

# Optional: Webhooks (for call analytics)
MAKE_WEBHOOK_URL=https://hook.eu2.make.com/your-webhook-id
MAKE_WEBHOOK_SECRET=your-webhook-secret

# Optional: Google OAuth (if implementing social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Test Configuration
```bash
# Start the server
node server-fixed.js

# Test health endpoint
curl http://localhost:8080/health

# Should return:
{
  "status": "OK",
  "environment": {
    "vapi_configured": true,
    "supabase_configured": true
  }
}
```

## 🚀 Deployment

### Local Development
```bash
npm start
# or
node server-fixed.js
```

### Vercel Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard:
   - Go to project settings
   - Add all `.env` variables under "Environment Variables"
   - Redeploy after adding variables

## 🧪 Testing Setup

### 1. Test Database Connection
Visit: `http://localhost:8080/health`
- Should show `supabase_configured: true`

### 2. Test VAPI Connection
Visit: `http://localhost:8080/api/test/vapi`
- Should return success or specific error message

### 3. Test User Registration
1. Go to `http://localhost:8080/auth`
2. Sign up with email
3. Check Supabase "Authentication" > "Users"
4. Check `profiles` table has new user

### 4. Test Assistant Creation
1. Login and go to `http://localhost:8080/create-assistant`
2. Fill out form and create assistant
3. Check `assistants` table in Supabase
4. Should see new assistant with VAPI ID

## 🔧 Common Issues

### "Supabase not configured"
- Check `.env` file exists and has correct values
- Restart server after changing `.env`
- Verify Supabase URL format: `https://xxxxx.supabase.co`

### "VAPI connection failed"
- Check VAPI API key is correct
- Test key in VAPI dashboard first
- Check VAPI account has credits

### "RLS policy" errors
- Make sure you ran the complete schema
- Check user is authenticated
- Verify JWT token is valid

### Assistant creation fails
- Check VAPI integration
- Verify database schema is complete
- Check server logs for specific error

## 📁 Project Structure
```
voice-matrix-ai/
├── server-fixed.js          # Main server (production)
├── vercel.json              # Vercel deployment config
├── database/
│   └── complete-schema.sql  # Complete database setup
├── api/                     # API routes
│   ├── assistants/
│   ├── phone-numbers/
│   └── webhooks/
├── services/                # Business logic
│   ├── assistant.service.js
│   ├── vapi.service.js
│   └── supabase.service.js
├── public/                  # Frontend files
│   ├── create-assistant.html
│   ├── auth.html
│   └── dashboard.html
└── middleware/              # Express middleware
    └── auth.middleware.js
```

## 🎯 Features Included
- ✅ User authentication (email/password)
- ✅ AI assistant creation and management
- ✅ VAPI integration for voice processing
- ✅ Demo account system (7-day expiry, 2 assistants max)
- ✅ Call logging and analytics
- ✅ Phone number management
- ✅ Row Level Security (RLS) for data isolation
- ✅ Usage tracking and limits

## 🔐 Security Notes
- Service role key should never be exposed to frontend
- VAPI API key is server-side only
- All database access uses RLS policies
- JWT tokens validate user permissions

## 📞 Support
If you need help:
1. Check server logs for specific errors
2. Test individual components using debug endpoints
3. Verify environment variables are set correctly
4. Check Supabase and VAPI dashboards for issues

---

**Ready to build AI voice assistants! 🎉**