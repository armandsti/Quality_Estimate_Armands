const { GoogleGenAI } = require('@google/genai');

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
    const { mime, base64 } = req.body;

    // Validate required fields
    if (!mime || !base64) {
      return res.status(400).json({ error: 'MIME type and base64 data are required' });
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

    // Create the image part
    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: mime
      }
    };

    // Build the prompt for OCR
    const prompt = `Please extract all the text from this image. Return only the extracted text, maintaining the original formatting and structure as much as possible. Do not add any explanations or additional text.`;

    // Generate response
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }]
    });
    const response = await result.response;
    const extractedText = response.text();

    res.status(200).json({ text: extractedText });

  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: error.message || 'OCR failed' });
  }
}
