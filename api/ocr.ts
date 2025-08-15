import { GoogleGenAI } from '@google/genai';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // API key is ONLY available here on the server - never exposed to frontend
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const { mime, base64 } = req.body;
    
    if (!mime || !base64) {
      return res.status(400).json({ error: 'MIME type and base64 data are required' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = { inlineData: { data: base64, mimeType: mime } };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [
          imagePart, 
          { text: "Extract all text from this image. Preserve line breaks and paragraph structure." }
        ] 
      },
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

    return res.status(200).json({ text: response.text });

  } catch (error: any) {
    console.error('OCR server error:', error);
    return res.status(500).json({ error: error.message || 'OCR failed' });
  }
}

