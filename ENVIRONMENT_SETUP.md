# Environment Setup

## Required Environment Variables

To use this application, you need to set up the following environment variable:

### 1. Create a `.env` file in the project root:

```bash
GEMINI_API_KEY=AIzaSyBhtKh_i3R6e6DqY-RIsTWTtMnUBFcUFsI
```

### 2. Alternative: Set environment variable directly

If you prefer not to use a `.env` file, you can set the environment variable directly:

**On macOS/Linux:**
```bash
export GEMINI_API_KEY=AIzaSyBhtKh_i3R6e6DqY-RIsTWTtMnUBFcUFsI
```

**On Windows:**
```cmd
set GEMINI_API_KEY=AIzaSyBhtKh_i3R6e6DqY-RIsTWTtMnUBFcUFsI
```

### 3. Restart your development server

After setting the environment variable, restart your development server:

```bash
npm run dev
```

## Security Note

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- Keep your API key secure and don't share it publicly

## Testing the Setup

Once configured, you should be able to:
1. Upload source and target documents
2. Run AI-powered quality assurance analysis
3. Export results to Excel or corrected documents



