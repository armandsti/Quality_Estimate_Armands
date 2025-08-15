import { GoogleGenAI, Type } from '@google/genai';

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
  Please identify all translation errors. If you find multiple errors within a single segment, you MUST group them into a single entry for that segment. This single entry should have a consolidated description summarizing all issues, and provide a single "suggestedCorrection" that resolves all identified errors simultaneously. The 'severity' should reflect the most critical error found in that segment. The 'errorCategory' and 'errorType' should also reflect the primary or most severe issue.

  For each segment with errors, provide the original source segment, the problematic target segment, the primary error category, the primary error type, a consolidated description, a single suggested correction that fixes all issues, and the most critical severity level.

  The source text may contain segment identifiers like "[Segment 123]". If you find an error in a segment that has such an identifier, please capture the full identifier (e.g., "[Segment 123]") and return it in the 'segmentId' field. For the 'sourceSegment' field, return the segment text *without* this identifier.

  For \`sourceHighlight\`, \`targetHighlight\`, and \`suggestionHighlight\`, identify all relevant phrases. If there are multiple distinct phrases, combine them into a single string separated by the pipe character '|' (e.g., "error one|error two").

  Return the response as a valid JSON array of objects with these fields: segmentId, sourceSegment, targetSegment, sourceHighlight, targetHighlight, errorCategory, errorType, description, suggestedCorrection, suggestionHighlight, severity.
  `;
  return prompt;
};

// Response schema for Gemini
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      segmentId: {
        type: Type.STRING,
        description: "The unique identifier of the segment (e.g., '[Segment 123]'), if one was provided in the source text. Should be omitted if no identifier is present.",
      },
      sourceSegment: {
        type: Type.STRING,
        description: "The exact segment from the source text where the issue originates, excluding any segment ID prefix.",
      },
      targetSegment: {
        type: Type.STRING,
        description: "The corresponding segment from the target text containing the error.",
      },
      sourceHighlight: {
        type: Type.STRING,
        description: "The specific text within the source segment that is relevant to the error. Pipe-separated for multiple.",
      },
      targetHighlight: {
        type: Type.STRING,
        description: "The specific text within the target segment that contains the error. Pipe-separated for multiple.",
      },
      errorCategory: {
        type: Type.STRING,
        description: "The main category of the error.",
        enum: ["Accuracy", "Completeness", "Consistency", "Fluency", "Style", "Terminology"],
      },
      errorType: {
        type: Type.STRING,
        description: "A specific classification of the error (e.g., Mistranslation, Grammar, Wrong term).",
      },
      description: {
        type: Type.STRING,
        description: "A clear and concise explanation of the error. Consolidated if multiple errors.",
      },
      suggestedCorrection: {
        type: Type.STRING,
        description: "A corrected version of the target segment. Fixes all issues if multiple.",
      },
      suggestionHighlight: {
        type: Type.STRING,
        description: "The specific text within the suggested correction that has been changed. Pipe-separated for multiple.",
      },
      severity: {
        type: Type.STRING,
        description: "The severity of the error. Should be the most critical if multiple errors exist.",
        enum: ["Critical", "Major", "Minor"],
      },
    },
    required: ["sourceSegment", "targetSegment", "errorCategory", "errorType", "description", "suggestedCorrection", "severity"],
  },
};

// Vercel serverless function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // API key is ONLY available here on the server - never exposed to frontend
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const { sourceText, targetText, glossaryText, referenceText, websiteText } = req.body;

    if (!sourceText || !targetText) {
      return res.status(400).json({ error: 'Source and target text are required' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(sourceText, targetText, glossaryText, referenceText, websiteText);

    // Add retry logic for API calls
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
          },
        });

        if (response.promptFeedback && response.promptFeedback.blockReason) {
          const blockReason = response.promptFeedback.blockReason;
          const blockMessage = response.promptFeedback.blockReasonMessage || 'No additional details provided.';
          throw new Error(`The request was blocked by the safety filter. Reason: ${blockReason}. Message: ${blockMessage}`);
        }

        const jsonText = response.text;
    
        if (!jsonText || jsonText.trim() === "") {
          // If the model returns an empty response, it might mean no errors were found.
          return res.status(200).json([]);
        }

        const result = JSON.parse(jsonText.trim());
        return res.status(200).json(result);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry for blocked requests
        if (lastError.message.startsWith('The request was blocked')) {
          throw lastError;
        }
        
        console.error(`Gemini API attempt ${attempt} failed:`, lastError);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    throw new Error(`Gemini API request failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Analysis failed' });
  }
}
