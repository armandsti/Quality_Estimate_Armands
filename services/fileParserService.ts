import mammoth from 'mammoth';
import { extractTextFromImage } from './geminiService';

// pdfjs-dist is loaded from a CDN in index.html, so we declare the global variable.
declare const pdfjsLib: any;

export async function parseFile(file: File): Promise<string> {
  // Add file size validation
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  const fileNameLower = file.name.toLowerCase();

  // mammoth.js only supports .docx, not the legacy .doc format.
  if (fileNameLower.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("Error parsing .docx file:", error);
        throw new Error(`The file "${file.name}" appears to be corrupt or is not a valid .docx file.`);
    }
  } 
  
  if (fileNameLower.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported. Please save the file in .docx format and try again.');
  }

  if (file.type === 'image/jpeg' || fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg')) {
    return extractTextFromImage(file);
  }
  
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let textContent = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      textContent += text.items.map((item: any) => item.str).join(' ');
      textContent += '\n'; // Add newline between pages
    }
    return textContent;
  }
  
  // Handle various text and XML-based formats by reading them as plain text.
  // This is used for glossaries, references, or single-language targets.
  // Bilingual files uploaded as a "source" are handled by parseBilingualFile.
  const textBasedExtensions = ['.txt', '.xml', '.xliff', '.xlf', '.tmx', '.sdlxliff'];
  if (
    file.type === 'text/plain' || 
    file.type === 'application/xml' || 
    file.type === 'text/xml' || 
    textBasedExtensions.some(ext => fileNameLower.endsWith(ext))
  ) {
     return file.text();
  }
  
  throw new Error('Unsupported file type. Please use .docx, .pdf, .txt, .jpeg, .xliff, .sdlxliff, or .tmx');
}

export async function parseBilingualFile(file: File): Promise<{source: string, target: string}> {
    if (typeof DOMParser === 'undefined') {
        throw new Error('DOMParser not available in this environment. Please use a modern browser.');
    }
    
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
        console.error("XML Parse Error:", parserError.textContent);
        throw new Error(`The file "${file.name}" is not a well-formed XML file. Please check the file format.`);
    }
    
    // Additional validation for empty or invalid XML
    if (!xmlDoc.documentElement) {
        throw new Error(`The file "${file.name}" appears to be empty or contains invalid XML content.`);
    }

    const fileNameLower = file.name.toLowerCase();
    let sourceSegments: string[] = [];
    let targetSegments: string[] = [];
    let segCounter = 1;

    if (fileNameLower.endsWith('.xliff') || fileNameLower.endsWith('.xlf') || fileNameLower.endsWith('.sdlxliff')) {
        const transUnits = xmlDoc.getElementsByTagName('trans-unit');
        
        for (const unit of Array.from(transUnits)) {
            // Check for Trados-style segmented content first (<seg-source> with <mrk> tags)
            const segSourceMarkers = unit.querySelectorAll('seg-source > mrk[mtype="seg"]');
            
            if (segSourceMarkers.length > 0) {
                const targetMarkers = Array.from(unit.querySelectorAll('target > mrk[mtype="seg"]'));
                // Create a map for efficient lookup of target segments by their ID
                const targetMarkersMap = new Map(targetMarkers.map(m => [m.getAttribute('mid'), m]));

                for (const sourceMarker of Array.from(segSourceMarkers)) {
                    const segmentId = sourceMarker.getAttribute('mid');
                    const sourceText = sourceMarker.textContent;
                    
                    if (segmentId && sourceText?.trim()) {
                        const targetMarker = targetMarkersMap.get(segmentId);
                        const targetText = targetMarker?.textContent || '';
                        
                        sourceSegments.push(`[Segment ${segmentId}] ${sourceText}`);
                        targetSegments.push(targetText);
                    }
                }
            } else { // Fallback for standard XLIFF 1.2 or other variants without <seg-source>
                const sourceNode = unit.querySelector('source');
                const targetNode = unit.querySelector('target');
                
                if (sourceNode?.textContent?.trim()) { // Check for non-empty content
                    // Use a sequential counter for predictable segment numbering
                    sourceSegments.push(`[Segment ${segCounter}] ${sourceNode.textContent}`);
                    targetSegments.push(targetNode?.textContent || '');
                    segCounter++;
                }
            }
        }
    } else if (fileNameLower.endsWith('.tmx')) {
        const tus = xmlDoc.getElementsByTagName('tu');
        for (const tu of Array.from(tus)) {
            const tuvs = tu.getElementsByTagName('tuv');
            if (tuvs.length >= 2) {
                // Assuming first tuv is source and second is target
                const sourceSeg = tuvs[0].querySelector('seg');
                const targetSeg = tuvs[1].querySelector('seg');
                if (sourceSeg?.textContent?.trim()) {
                    sourceSegments.push(`[Segment ${segCounter}] ${sourceSeg.textContent}`);
                    targetSegments.push(targetSeg?.textContent || '');
                    segCounter++;
                }
            }
        }
    }

    if (sourceSegments.length === 0) {
        throw new Error(`Could not extract source/target pairs from "${file.name}". The file may not be a standard XLIFF or TMX file, or it may be empty.`);
    }

    return {
        source: sourceSegments.join('\n\n'),
        target: targetSegments.join('\n\n'),
    };
}