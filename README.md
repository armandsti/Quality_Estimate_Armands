# QA Riks - AI Translation Quality Assistant

## Overview
AI-powered translation quality assessment tool that analyzes source and target language files to identify translation errors, inconsistencies, and areas for improvement.

## Features

- **Document Upload**: Support for multiple file formats (DOCX, PDF, etc.)
- **AI Analysis**: Powered by Google Gemini AI for intelligent document analysis
- **Quality Assurance**: Automated quality checks for translated content
- **User Authentication**: Secure login with Supabase integration
- **History Management**: Persistent storage of analysis sessions
- **Export Results**: Download analysis reports in various formats
- **Modern UI**: Built with React and TypeScript for a smooth user experience
- **Statistics Panel**: Real-time analytics and progress tracking

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Authentication & Database**: Supabase
- **AI Services**: Google Gemini AI
- **Document Processing**: Mammoth.js, Docx.js
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Deployment**: Vercel with serverless functions

## Prerequisites

- Node.js (version 18 or higher)
- Google Gemini API key
- Supabase account and project

## Installation & Setup

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd qa-riks-ai-translation-assistant
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```bash
# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Database Setup
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Get your Project URL and Anon public key from Settings → API
3. In the Supabase SQL Editor, run the contents of `database-schema.sql`
4. (Optional) Configure Google OAuth in Authentication → Providers

### 4. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run server` - Run Node.js server (if needed)
- `npm run dev:full` - Run both server and dev concurrently

## Project Structure

```
├── api/              # Vercel serverless functions
│   ├── analyze.js    # AI analysis endpoint
│   └── ocr.js        # OCR processing endpoint
├── components/       # React components
│   ├── Auth/         # Authentication components
│   ├── *.tsx         # UI components
├── services/         # Business logic services
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── stores/          # Zustand state management
├── types.ts         # TypeScript type definitions
└── App.tsx          # Main application component
```

## Key Features Explained

### Authentication System
- Email/password signup and login
- Google OAuth integration (optional)
- User profiles with persistent data
- Row-level security for data protection

### Analysis Workflow
1. Upload source and target documents
2. AI analyzes content for quality issues
3. Review and manage QA errors
4. Export corrected documents
5. History automatically saved

### Statistics & Analytics
- Global system-wide statistics tracking
- User-specific analysis history
- Quality metrics and acceptance rates
- Professional reporting dashboard

## Deployment

### Vercel Deployment
1. Push code to GitHub
2. Import repository in Vercel
3. Configure environment variables:
   - `GEMINI_API_KEY`
   - `VITE_SUPABASE_URL` 
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automatically

### What Works on Vercel
✅ Authentication system (Supabase)  
✅ AI analysis (via serverless functions)  
✅ OCR functionality (via serverless functions)  
✅ Database operations (Supabase)  
✅ File processing (client-side)  
✅ Export functionality (client-side)

### Limitations
❌ Long-running processes (60s serverless timeout)  
❌ File storage (use Supabase Storage instead)  
❌ Background jobs (need external service)

## Database Schema

The app uses three main tables:

### `profiles`
- User profile information
- Automatically created on signup
- Links to Supabase auth.users

### `analysis_history`
- Analysis session metadata
- File names, error counts, severity breakdowns
- Links to user profiles

### `analysis_errors`
- Individual QA errors from analyses
- Error details, suggestions, resolution status
- Links to analysis history entries

## Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Automatic profile creation**: Profiles created on signup
- **Cascading deletes**: History deletion removes associated errors
- **Input validation**: All data validated before storage
- **Centralized API calls**: No client-side API keys exposed

## Development Notes

### Architecture Improvements
- Modular component structure
- Centralized state management with Zustand
- Custom hooks for reusable logic
- Enhanced error boundaries
- Type-safe API layer

### Performance Optimizations
- Selective state subscriptions
- Persistent state with localStorage fallback
- Optimized re-renders
- Efficient error handling

## Troubleshooting

### Common Issues
1. **"Missing Supabase environment variables"**
   - Check `.env.local` exists and has correct values
   - Restart dev server after adding variables

2. **"Analysis Failed" Error**
   - Verify `GEMINI_API_KEY` is correct
   - Check API key has sufficient quota

3. **Authentication Issues**
   - Verify Supabase environment variables
   - Ensure Supabase project is active

4. **Database Connection Issues**
   - Run database schema SQL in Supabase
   - Check RLS policies are created
   - Verify user authentication works

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.