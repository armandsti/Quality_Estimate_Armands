
import { GoogleGenAI, Type } from "@google/genai";
import { QAError, Severity, ErrorCategory } from "../types";

const buildPrompt = (sourceText: string, targetText: string, glossaryText: string, referenceText: string, websiteText: string): string => {
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
    `;
    return prompt;
};


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
        enum: Object.values(ErrorCategory),
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
        enum: Object.values(Severity),
      },
    },
    required: ["sourceSegment", "targetSegment", "errorCategory", "errorType", "description", "suggestedCorrection", "severity"],
  },
};

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

export async function extractTextFromImage(file: File): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable not set for OCR.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const imagePart = await fileToGenerativePart(file);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, {text: "Extract all text from this image. Preserve line breaks and paragraph structure."}] },
        });

        if (response.promptFeedback && response.promptFeedback.blockReason) {
          const blockReason = response.promptFeedback.blockReason;
          const blockMessage = response.promptFeedback.blockReasonMessage || 'No additional details provided.';
          throw new Error(`The image was blocked by the safety filter. Reason: ${blockReason}. Message: ${blockMessage}`);
        }

        if (!response.text) {
            console.error("OCR Error: Gemini response did not contain text. Full response:", response);
            throw new Error("Image text extraction failed: the model returned an empty response.");
        }

        return response.text;
    } catch(error) {
        console.error("Error calling Gemini API for OCR:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API request failed during OCR: ${error.message}`);
        }
        throw new Error("An unknown error occurred during image text extraction.");
    }
}


export async function runQAAnalysis(
  sourceText: string,
  targetText: string,
  glossaryText: string,
  referenceText: string,
  websiteText: string
): Promise<QAError[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(sourceText, targetText, glossaryText, referenceText, websiteText);

  // Add retry logic for API calls
  const maxRetries = 3;
  let lastError: Error | null = null;

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
        return [];
      }

      const result: Omit<QAError, 'id' | 'resolved' | 'rejected'>[] = JSON.parse(jsonText.trim());
      
      // Add id and resolved status to each error for UI tracking
      return result.map((error, index) => ({
        ...error,
        id: index,
        resolved: false,
        rejected: false,
      }));

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
}