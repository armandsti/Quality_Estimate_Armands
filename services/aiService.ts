import { QAError } from '../types';

export async function runQAAnalysis(
  sourceText: string,
  targetText: string,
  glossaryText: string,
  referenceText: string,
  websiteText: string
): Promise<QAError[]> {
  console.log('🔍 Starting QA Analysis...');
  console.log('📝 Source text length:', sourceText.length);
  console.log('📝 Target text length:', targetText.length);
  
  try {
    // Frontend has NO API key - it just calls your secure server
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceText, targetText, glossaryText, referenceText, websiteText })
    });

    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
      }
      
      throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Analysis completed successfully, found', data.length, 'issues');
    
    return (data as any[]).map((error: any, index: number) => ({
      ...error,
      id: crypto.randomUUID(),
      resolved: false,
      rejected: false
    }));
  } catch (error) {
    console.error('🚨 Analysis error:', error);
    throw error;
  }
}

export async function extractTextFromImage(file: File): Promise<string> {
  // Convert file to base64 for secure transmission
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  // Frontend has NO API key - it just calls your secure server
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mime: file.type, base64 })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'OCR failed');
  }

  const { text } = await response.json();
  return text || '';
}

