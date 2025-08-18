# Database Setup Guide for QA Analysis Tool

This guide will help you set up Supabase database integration for user authentication and persistent history storage.

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `qa-analysis-tool` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your users
5. Click "Create new project"
6. Wait for the project to be created (usually 2-3 minutes)

### 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (starts with `https://`)
   - **Anon public key** (starts with `eyJ`)

### 3. Set Up Environment Variables

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add these variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google Gemini AI (existing)
GEMINI_API_KEY=your-gemini-api-key-here
```

3. Replace the placeholder values with your actual Supabase credentials

### 4. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `database-schema.sql`
3. Paste it into the SQL editor
4. Click "Run" to execute the schema

### 5. Configure Google OAuth (Optional)

If you want to enable Google sign-in:

1. Go to **Authentication** → **Providers** in Supabase
2. Find **Google** and click "Enable"
3. Go to [Google Cloud Console](https://console.cloud.google.com/)
4. Create a new project or select existing one
5. Enable Google+ API
6. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
7. Set application type to "Web application"
8. Add authorized redirect URIs:
   - `https://your-project-id.supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback` (for local development)
9. Copy the Client ID and Client Secret
10. Back in Supabase, paste these values and save

## 🔧 Database Schema Overview

The setup creates three main tables:

### `profiles`
- Stores user profile information
- Automatically created when users sign up
- Links to Supabase auth.users table

### `analysis_history`
- Stores analysis session metadata
- Includes file names, error counts, severity breakdowns
- Links to user profiles

### `analysis_errors`
- Stores individual QA errors from each analysis
- Includes error details, suggestions, and resolution status
- Links to analysis history entries

## 🔒 Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Automatic profile creation**: Profiles are created automatically on signup
- **Cascading deletes**: Deleting history entries removes associated errors
- **Input validation**: All data is validated before storage

## 🧪 Testing the Setup

1. Start your development server: `npm run dev`
2. Navigate to the app
3. You should see the authentication form
4. Try creating an account with email/password
5. Or sign in with Google (if configured)
6. After authentication, try uploading and analyzing a document
7. Check that history is saved and persists between sessions

## 🚨 Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Check that `.env.local` exists and has correct values
   - Restart your dev server after adding environment variables

2. **"Failed to save to database"**
   - Verify database schema was created correctly
   - Check Supabase logs for SQL errors
   - Ensure RLS policies are in place

3. **"Authentication failed"**
   - Verify Supabase URL and anon key are correct
   - Check that auth is enabled in Supabase dashboard
   - Ensure Google OAuth is configured correctly (if using)

4. **"Permission denied"**
   - Run the database schema SQL again
   - Check that RLS policies are created
   - Verify user authentication is working

### Getting Help

- Check Supabase logs in the dashboard
- Review browser console for JavaScript errors
- Verify environment variables are loaded correctly
- Test database connections in Supabase dashboard

## 🔄 Migration from localStorage

The app automatically migrates existing localStorage data:
- On first login, existing history is loaded from localStorage
- New analyses are saved to both database and localStorage
- Database takes precedence for authenticated users
- Fallback to localStorage if database operations fail

## 📱 Production Deployment

When deploying to production:
1. Update redirect URIs in Google OAuth to include your production domain
2. Ensure environment variables are set in your hosting platform
3. Test authentication flow in production environment
4. Monitor database performance and usage

## 🎯 Next Steps

After setup is complete, you can:
- Customize user profiles and settings
- Add more authentication providers (GitHub, Discord, etc.)
- Implement user roles and permissions
- Add analytics and usage tracking
- Set up automated backups and monitoring
