# Database Schema Documentation

## Schema File:

### `schema.sql`
- **Purpose**: Database schema with Supabase Auth integration
- **Features**:
  - Integrates with Supabase Auth (auth.users)
  - Row Level Security (RLS) enabled
  - Auto-creates user profiles on signup
  - All tables properly linked to authenticated users
  - Usage limits and tracking

## How to Apply Schema:

1. **In Supabase SQL Editor**:
   - Copy contents of `schema.sql`
   - Select "postgres" role
   - Click Run

2. **Schema creates**:
   - profiles table (linked to auth.users)
   - assistants table
   - phone_numbers table
   - call_analytics table
   - user_limits table
   - usage_logs table
   - All necessary RLS policies
   - Auto-profile creation trigger

## Migration Notes:
- If migrating from old schema, you'll need to drop all existing tables first
- The new schema uses Supabase Auth user IDs instead of random UUIDs