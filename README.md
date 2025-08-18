# QA Riks - AI Translation Quality Assistant

<!-- FORCE FRESH VERCEL DEPLOYMENT - Updated: 2024-12-19 16:00 UTC - Authentication fixes included -->
<!-- Previous deployment may be serving cached content - this forces a complete rebuild -->

## Overview
AI-powered translation quality assessment tool that analyzes source and target language files to identify translation errors, inconsistencies, and areas for improvement.

## Features

- **Document Upload**: Support for multiple file formats (DOCX, PDF, etc.)
- **AI Analysis**: Powered by Google Gemini AI for intelligent document analysis
- **Quality Assurance**: Automated quality checks for translated content
- **Modern UI**: Built with React and TypeScript for a smooth user experience
- **Export Results**: Download analysis reports in various formats

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Services**: Google Gemini AI
- **Document Processing**: Mammoth.js, Docx.js
- **Styling**: CSS3 with modern design principles

## Prerequisites

- Node.js (version 18 or higher)
- Google Gemini API key

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd qa-riks-ai-translation-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

```
├── api/              # API endpoints
├── components/       # React components
├── services/         # Business logic services
├── types/           # TypeScript type definitions
└── App.tsx          # Main application component
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.
#Testaaabbbcccc
