const { GoogleGenAI, Type } = require('@google/genai');

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
        description: "The exact segment from the target text where the issue is found.",
      },
      sourceHighlight: {
        type: Type.STRING,
        description: "Specific phrases or words in the source text that are relevant to the error. Multiple phrases should be separated by '|'.",
      },
      targetHighlight: {
        type: Type.STRING,
        description: "Specific phrases or words in the target text that contain the error. Multiple phrases should be separated by '|'.",
      },
      errorCategory: {
        type: Type.STRING,
        description: "The category of the error: 'Accuracy', 'Fluency', 'Terminology', 'Style', 'Format', 'Consistency', or 'Other'.",
      },
      errorType: {
        type: Type.STRING,
        description: "The specific type of error: 'Mistranslation', 'Omission', 'Addition', 'Grammar', 'Spelling', 'Punctuation', 'Capitalization', 'Number format', 'Date format', 'Currency format', 'Unit conversion', 'Cultural adaptation', 'Register mismatch', 'Tone mismatch', 'Terminology inconsistency', 'Style inconsistency', or 'Other'.",
      },
      description: {
        type: Type.STRING,
        description: "A clear, concise description of the error and why it's problematic.",
      },
      suggestedCorrection: {
        type: Type.STRING,
        description: "The corrected version of the target segment that fixes all identified issues.",
      },
      suggestionHighlight: {
        type: Type.STRING,
        description: "Specific phrases or words in the suggested correction that address the error. Multiple phrases should be separated by '|'.",
      },
      severity: {
        type: Type.STRING,
        description: "The severity level: 'Critical' (major meaning error), 'Major' (significant quality issue), or 'Minor' (minor formatting or style issue).",
      },
    },
    required: ["sourceSegment", "targetSegment", "sourceHighlight", "targetHighlight", "errorCategory", "errorType", "description", "suggestedCorrection", "suggestionHighlight", "severity"],
  },
};

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceText, targetText, glossaryText, referenceText, websiteText } = req.body;

    // Validate required fields
    if (!sourceText || !targetText) {
      return res.status(400).json({ error: 'Source text and target text are required' });
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable not set');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Initialize Gemini
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build the prompt
    const prompt = buildPrompt(sourceText, targetText, glossaryText, referenceText, websiteText);

    // Generate response with schema
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });
    const response = await result.response;
    const text = response.text();

    // Parse the response
    let analysisResults;
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analysisResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      console.error('Raw response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Validate and format the results
    const formattedResults = analysisResults.map((error, index) => ({
      id: index,
      segmentId: error.segmentId || '',
      sourceSegment: error.sourceSegment || '',
      targetSegment: error.targetSegment || '',
      sourceHighlight: error.sourceHighlight || '',
      targetHighlight: error.targetHighlight || '',
      errorCategory: error.errorCategory || 'Other',
      errorType: error.errorType || 'Other',
      description: error.description || '',
      suggestedCorrection: error.suggestedCorrection || '',
      suggestionHighlight: error.suggestionHighlight || '',
      severity: error.severity || 'Minor',
      resolved: false,
      rejected: false
    }));

    res.status(200).json(formattedResults);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
}
