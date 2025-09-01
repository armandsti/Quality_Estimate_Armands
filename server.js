import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Also try loading from .env if .env.local doesn't exist
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: '.env' });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(join(__dirname, 'dist')));

// API keys are ONLY available here on the server - never exposed to frontend
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!openaiApiKey) {
  console.error('❌ OPENAI_API_KEY environment variable not set!');
  console.error('Please add your OpenAI API key to the .env.local file');
  process.exit(1);
}

console.log('✅ OpenAI API Key configured successfully');

// Gemini API key is optional (only used for OCR)
if (geminiApiKey) {
  console.log('✅ Gemini API Key also configured (for OCR functionality)');
} else {
  console.log('⚠️  Gemini API Key not configured (OCR functionality will be limited)');
}

// Build prompt function
const buildPrompt = (sourceText, targetText, glossaryText, referenceText, websiteText) => {
  let prompt = `Analyze the following translation for quality assurance.
  
  **Source Text:**
  \`\`\`
  ${sourceText}
  \`\`\`

  **Target Text:**
  \`\`\`
  ${targetText}
  \`\`\`
  `;

  if (glossaryText) {
    prompt += `
    **Glossary (must be followed):**
    \`\`\`
    ${glossaryText}
    \`\`\`
    `;
  }

  if (referenceText) {
    prompt += `
    **Reference Translations (for consistency):**
    \`\`\`
    ${referenceText}
    \`\`\`
    `;
  }

  if (websiteText) {
    prompt += `
    **Reference Websites (for style, tone, and terminology):**
    The following URLs point to reference websites. The translation's style, tone, and terminology should be consistent with the content found at these URLs. You are expected to use your knowledge of the content on these sites to inform your analysis.
    \`\`\`
    ${websiteText}
    \`\`\`
    `;
  }
  
  prompt += `
  Please identify all translation errors. Only report actual errors - do NOT include entries for segments that have no errors.

  If you find multiple errors within a single segment, you MUST group them into a single entry for that segment. This single entry should have a consolidated description summarizing all issues, and provide a single "suggestedCorrection" that resolves all identified errors simultaneously. The 'severity' should reflect the most critical error found in that segment. The 'errorCategory' and 'errorType' should also reflect the primary or most severe issue.

  IMPORTANT: Use only these exact values for categories and severities:
  - errorCategory: "Accuracy", "Completeness", "Consistency", "Fluency", "Style", "Terminology"
  - severity: "Critical", "Major", "Minor"

  For each segment with actual errors, provide:
  - sourceSegment: The exact segment from the source text where the issue originates
  - targetSegment: The corresponding segment from the target text containing the error
  - errorCategory: One of the exact categories listed above
  - errorType: A specific classification (e.g., "Mistranslation", "Grammar", "Wrong term")
  - description: A clear explanation of the error
  - suggestedCorrection: A corrected version of the target segment
  - severity: One of "Critical", "Major", or "Minor"
  - sourceHighlight: Specific text from source relevant to the error (optional)
  - targetHighlight: Specific text from target containing the error (optional)
  - suggestionHighlight: Text in the correction that changed (optional)

  The source text may contain segment identifiers like "[Segment 123]". If you find an error in a segment that has such an identifier, please capture the full identifier (e.g., "[Segment 123]") and return it in the 'segmentId' field. For the 'sourceSegment' field, return the segment text *without* this identifier.

  Return ONLY a JSON array of error objects. If there are no errors found, return an empty array []. Do not include any explanatory text outside of the JSON.
  `;
  return prompt;
};

// Response schema for Gemini (using structured output)
const responseSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      segmentId: {
        type: "string",
        description: "The unique identifier of the segment (e.g., '[Segment 123]'), if one was provided in the source text. Should be omitted if no identifier is present.",
      },
      sourceSegment: {
        type: "string",
        description: "The exact segment from the source text where the issue originates, excluding any segment ID prefix.",
      },
      targetSegment: {
        type: "string",
        description: "The corresponding segment from the target text containing the error.",
      },
      sourceHighlight: {
        type: "string",
        description: "The specific text within the source segment that is relevant to the error. Pipe-separated for multiple.",
      },
      targetHighlight: {
        type: "string",
        description: "The specific text within the target segment that contains the error. Pipe-separated for multiple.",
      },
      errorCategory: {
        type: "string",
        description: "The main category of the error.",
        enum: ["Accuracy", "Completeness", "Consistency", "Fluency", "Style", "Terminology"],
      },
      errorType: {
        type: "string",
        description: "A specific classification of the error (e.g., Mistranslation, Grammar, Wrong term).",
      },
      description: {
        type: "string",
        description: "A clear and concise explanation of the error. Consolidated if multiple errors.",
      },
      suggestedCorrection: {
        type: "string",
        description: "A corrected version of the target segment. Fixes all issues if multiple.",
      },
      suggestionHighlight: {
        type: "string",
        description: "The specific text within the suggested correction that has been changed. Pipe-separated for multiple.",
      },
      severity: {
        type: "string",
        description: "The severity of the error. Should be the most critical if multiple errors exist.",
        enum: ["Critical", "Major", "Minor"],
      },
    },
    required: ["sourceSegment", "targetSegment", "errorCategory", "errorType", "description", "suggestedCorrection", "severity"],
  },
};

// API routes
app.post('/api/analyze', async (req, res) => {
  try {
    const { sourceText, targetText, glossaryText, referenceText, websiteText } = req.body;

    if (!sourceText || !targetText) {
      return res.status(400).json({ error: 'Source and target text are required' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const prompt = buildPrompt(sourceText, targetText, glossaryText, referenceText, websiteText);

    // Add retry logic for API calls
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Calling OpenAI API...`);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Using cost-effective model
          messages: [
            {
              role: "system",
              content: "You are an expert translation quality assurance specialist. Analyze translations for errors and provide detailed feedback in JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent analysis
          max_tokens: 4000,
          response_format: { type: "json_object" }
        });

        const response = completion.choices[0];
        if (!response || !response.message || !response.message.content) {
          throw new Error('Empty response from OpenAI API');
        }

        const text = response.message.content.trim();
        console.log('📄 Response text length:', text.length);

        if (!text || text === "") {
          console.log('⚠️ Empty response - no errors found');
          return res.status(200).json([]);
        }

        // Parse the JSON response
        let parsedResult;
        try {
          parsedResult = JSON.parse(text);
          console.log('✅ Successfully parsed JSON response');
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError);
          console.error('Raw response text:', text);
          throw new Error('Invalid JSON response from OpenAI API');
        }

        // Handle different response formats
        let issues = [];
        if (Array.isArray(parsedResult)) {
          issues = parsedResult;
        } else if (parsedResult.issues && Array.isArray(parsedResult.issues)) {
          issues = parsedResult.issues;
        } else if (parsedResult.errors && Array.isArray(parsedResult.errors)) {
          issues = parsedResult.errors;
        } else if (parsedResult.qa_issues && Array.isArray(parsedResult.qa_issues)) {
          issues = parsedResult.qa_issues;
        } else if (parsedResult.results && Array.isArray(parsedResult.results)) {
          issues = parsedResult.results;
        } else {
          // If it's a single object, wrap it in an array
          if (parsedResult.sourceSegment && parsedResult.targetSegment) {
            issues = [parsedResult];
          } else {
            console.error('❌ Unexpected response format:', parsedResult);
            throw new Error('OpenAI API returned unexpected response format');
          }
        }

        // Filter out entries with no errors (where errorCategory is "None" or similar)
        issues = issues.filter(issue =>
          issue.errorCategory &&
          issue.errorCategory !== 'None' &&
          issue.errorCategory !== 'none' &&
          issue.severity &&
          issue.severity !== 'None' &&
          issue.severity !== 'none'
        );

        console.log(`✅ Analysis completed successfully, found ${issues.length} issues`);
        return res.status(200).json(issues);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry for certain errors
        if (lastError.message.includes('insufficient_quota') ||
            lastError.message.includes('billing') ||
            lastError.message.includes('unauthorized')) {
          console.error('🚫 Non-retryable error:', lastError.message);
          throw lastError;
        }

        console.error(`❌ OpenAI API attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    throw new Error(`OpenAI API request failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

app.post('/api/ocr', async (req, res) => {
  try {
    const { mime, base64 } = req.body;

    if (!mime || !base64) {
      return res.status(400).json({ error: 'MIME type and base64 data are required' });
    }

    if (!geminiApiKey) {
      return res.status(503).json({
        error: 'OCR functionality is not available. Please configure GEMINI_API_KEY for image text extraction.'
      });
    }

    console.log('🔍 Starting OCR analysis...');

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent({
      contents: [{
        parts: [
          { inlineData: { data: base64, mimeType: mime } },
          { text: "Extract all text from this image. Preserve line breaks and paragraph structure." }
        ]
      }],
    });

    const response = result.response;
    console.log('📡 OCR response received');

    // Check for blocked content
    if (response.promptFeedback && response.promptFeedback.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      throw new Error(`The image was blocked by the safety filter. Reason: ${blockReason}`);
    }

    const text = response.text();
    console.log('📄 Extracted text length:', text.length);

    if (!text || text.trim() === "") {
      console.error("OCR Error: Empty response from Gemini");
      throw new Error("Image text extraction failed: the model returned an empty response.");
    }

    console.log('✅ OCR completed successfully');
    return res.status(200).json({ text: text.trim() });

  } catch (error) {
    console.error('OCR server error:', error);
    return res.status(500).json({ error: error.message || 'OCR failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'QA Riks API server is running' });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 QA Riks API server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Analysis: OpenAI GPT-4o-mini`);
  console.log(`📸 OCR: ${geminiApiKey ? 'Gemini 1.5 Pro' : 'Not available'}`);
  console.log(`💰 Cost-effective AI analysis with OpenAI`);
});

export default app;
