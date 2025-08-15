import { QAError } from '../types';

export async function runQAAnalysis(
  sourceText: string,
  targetText: string,
  glossaryText: string,
  referenceText: string,
  websiteText: string
): Promise<QAError[]> {
  // Frontend has NO API key - it just calls your secure server
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceText, targetText, glossaryText, referenceText, websiteText })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Analysis failed');
  }

  const data = await response.json();
  return (data as any[]).map((error: any, index: number) => ({
    ...error,
    id: index,
    resolved: false,
    rejected: false
  }));
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

