# Supabase Setup Instructions

Complete guide to set up Supabase for the QA Riks AI Translation Quality Assistant.

## 1. Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Verify your email if required

## 2. Create New Project

1. Click "New Project" from your dashboard
2. Fill in project details:
   - **Name**: `qa-riks-translation-app` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
3. Click "Create new project"
4. Wait 2-3 minutes for project initialization

## 3. Get Project Credentials

1. Go to **Settings** → **API** in your project dashboard
2. Copy these values (you'll need them for `.env.local`):
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon public key**: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`

## 4. Set Up Database Schema

1. Go to **SQL Editor** in your project dashboard
2. Click "New Query"
3. Copy the entire contents of `database-schema.sql` from your project
4. Paste it into the SQL editor
5. Click "Run" to execute the schema
6. Verify tables were created in **Database** → **Tables**

Expected tables:
- `profiles`
- `analysis_history`
- `analysis_errors`
- `shared_reports`
- `shared_report_reviewers`
- `shared_report_decisions`

## 5. Configure Authentication (Optional)

### Enable Google OAuth:
1. Go to **Authentication** → **Providers**
2. Enable "Google" provider
3. Add your Google OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
4. Add redirect URL: `https://your-project-id.supabase.co/auth/v1/callback`

### Email Settings:
1. Go to **Authentication** → **Settings**
2. Configure email templates if needed
3. Set site URL to your domain (e.g., `https://your-app.vercel.app`)

## 6. Environment Variables

Create `.env.local` in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google Gemini AI (if not already set)
GEMINI_API_KEY=your-gemini-api-key-here
```

## 7. Test the Connection

1. Start your development server: `npm run dev`
2. Try to sign up/login to test authentication
3. Create a new analysis to test database operations
4. Check **Authentication** → **Users** in Supabase to see new users
5. Check **Database** → **Table Editor** to see data

## 8. Production Deployment

### For Vercel:
1. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
2. Update site URL in Supabase **Authentication** → **Settings**
3. Add production domain to allowed origins

## 9. Security Checklist

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Proper policies for user data access
- ✅ Anon key is public-safe (no sensitive operations)
- ✅ Service role key kept secret (not in frontend)
- ✅ Email confirmation enabled (recommended)

## 10. Monitoring & Maintenance

### Regular Checks:
- Monitor **Database** → **Usage** for storage limits
- Check **Authentication** → **Users** for user activity
- Review **Logs** for errors or issues
- Monitor API usage in **Settings** → **Usage**

### Backup:
- Supabase automatically backs up your database
- For additional safety, export schema regularly
- Consider setting up monitoring alerts

## Troubleshooting

### Common Issues:

**"Missing Supabase environment variables"**
- Check `.env.local` file exists and has correct values
- Restart dev server after adding variables

**"Failed to fetch"**
- Verify project URL is correct
- Check if project is paused (free tier limitation)
- Ensure network connectivity

**"Row Level Security policy violation"**
- Check if user is authenticated
- Verify RLS policies are set up correctly
- Check user permissions in database

**Tables not found**
- Re-run the database schema SQL
- Check if schema was applied to correct project
- Verify table names match code expectations

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

**Note**: Keep your database password and service role key secure. Never commit them to version control.
