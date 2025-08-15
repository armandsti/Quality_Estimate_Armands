import { QAError } from '../types';
import saveAs from 'file-saver';
import JSZip from 'jszip';


// xlsx is loaded from a CDN in index.html
declare const XLSX: any;

export const exportToExcel = (errors: QAError[]) => {
  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }
  
  try {
    const worksheetData = errors.map(error => ({
      Severity: error.severity,
      Category: error.errorCategory,
      'Error Type': error.errorType,
      'Source Segment': error.sourceSegment,
      'Target Segment': error.targetSegment,
      'Suggested Correction': error.suggestedCorrection,
      Description: error.description,
    }));
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'QA Report');
  
  // Define column widths
  if (worksheetData.length > 0) {
    const colA_width = Math.max('Severity'.length, ...worksheetData.map(r => r.Severity?.length ?? 0)) + 2;
    const colB_width = Math.max('Category'.length, ...worksheetData.map(r => r.Category?.length ?? 0)) + 2;
    const colC_width = Math.max('Error Type'.length, ...worksheetData.map(r => r['Error Type']?.length ?? 0)) + 2;
    
    worksheet['!cols'] = [
        { wch: colA_width }, // A: Severity
        { wch: colB_width }, // B: Category
        { wch: colC_width }, // C: Error Type
        { wch: 70 }, // D: Source Segment
        { wch: 70 }, // E: Target Segment
        { wch: 70 }, // F: Suggested Correction
        { wch: 70 }, // G: Description
    ];
  }
  
  // Apply text wrapping and alignment to specific columns
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  // Start from R=1 to skip the header row.
  for (let R = 1; R <= range.e.r; ++R) {
    // Columns D, E, F, G correspond to indices 3, 4, 5, 6.
    for (let C = 3; C <= 6; ++C) {
      const cell_address = XLSX.utils.encode_cell({c: C, r: R});
      const cell = worksheet[cell_address];
      
      if (cell) {
        if (!cell.s) {
          cell.s = {};
        }
        cell.s.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      }
    }
  }
  
    XLSX.writeFile(workbook, 'Translation_QA_Report.xlsx');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export Excel file. Please try again.');
  }
};


// Helper function to escape XML special characters.
function escapeXml(text: string) {
    return text.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}

export const exportToCorrectedBilingualFile = async (
    originalFile: File,
    errorsToApply: QAError[],
    originalFilename: string
) => {
    try {
        const text = await originalFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "application/xml");

        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            console.error("XML Parse Error:", parserError.textContent);
            throw new Error(`The file "${originalFilename}" is not a well-formed XML file.`);
        }
        
        const fileNameLower = originalFilename.toLowerCase();
        const isXliff = fileNameLower.endsWith('.xliff') || fileNameLower.endsWith('.xlf') || fileNameLower.endsWith('.sdlxliff');
        const isTmx = fileNameLower.endsWith('.tmx');

        if (isXliff) {
            const transUnits = Array.from(xmlDoc.getElementsByTagName('trans-unit'));
            const sourceMap = new Map<string, Element[]>();
            for (const unit of transUnits) {
                const sourceNode = unit.querySelector('source');
                if (sourceNode?.textContent) {
                    const key = sourceNode.textContent.trim();
                    if (!sourceMap.has(key)) {
                        sourceMap.set(key, []);
                    }
                    sourceMap.get(key)!.push(unit);
                }
            }
            for (const error of errorsToApply) {
                const sourceKey = error.sourceSegment.trim();
                const matchingUnits = sourceMap.get(sourceKey);
                if (matchingUnits) {
                    const unitToUpdate = matchingUnits.find(unit => {
                        const targetNode = unit.querySelector('target');
                        return targetNode?.textContent?.trim() === error.targetSegment.trim();
                    });
                    if (unitToUpdate) {
                        const targetNode = unitToUpdate.querySelector('target');
                        if (targetNode) {
                            // Find the innermost element to preserve inline tags instead of replacing the whole content
                            let nodeToUpdate: Node = targetNode;
                            while (nodeToUpdate.firstChild && nodeToUpdate.childNodes.length === 1 && nodeToUpdate.firstChild.nodeType === Node.ELEMENT_NODE) {
                                nodeToUpdate = nodeToUpdate.firstChild;
                            }
                            nodeToUpdate.textContent = error.suggestedCorrection;
                        }
                    }
                }
            }
        } else if (isTmx) {
            const transUnits = Array.from(xmlDoc.getElementsByTagName('tu'));
            const sourceMap = new Map<string, Element[]>();
            for (const unit of transUnits) {
                const tuvs = Array.from(unit.getElementsByTagName('tuv'));
                if (tuvs.length > 0) {
                    const sourceSeg = tuvs[0].querySelector('seg');
                    if (sourceSeg?.textContent) {
                         const key = sourceSeg.textContent.trim();
                        if (!sourceMap.has(key)) {
                            sourceMap.set(key, []);
                        }
                        sourceMap.get(key)!.push(unit);
                    }
                }
            }
            for (const error of errorsToApply) {
                 const sourceKey = error.sourceSegment.trim();
                 const matchingUnits = sourceMap.get(sourceKey);
                 if (matchingUnits) {
                     const unitToUpdate = matchingUnits.find(unit => {
                         const tuvs = Array.from(unit.getElementsByTagName('tuv'));
                         if (tuvs.length > 1) {
                            const targetSeg = tuvs[1].querySelector('seg');
                            return targetSeg?.textContent?.trim() === error.targetSegment.trim();
                         }
                         return false;
                     });
                     if (unitToUpdate) {
                         const targetSeg = unitToUpdate.getElementsByTagName('tuv')[1]?.querySelector('seg');
                         if (targetSeg) {
                             // Find the innermost element to preserve inline tags
                            let nodeToUpdate: Node = targetSeg;
                            while (nodeToUpdate.firstChild && nodeToUpdate.childNodes.length === 1 && nodeToUpdate.firstChild.nodeType === Node.ELEMENT_NODE) {
                                nodeToUpdate = nodeToUpdate.firstChild;
                            }
                             nodeToUpdate.textContent = error.suggestedCorrection;
                         }
                     }
                 }
            }
        }
        
        const serializer = new XMLSerializer();
        const newXmlString = serializer.serializeToString(xmlDoc);

        const blob = new Blob([newXmlString], { type: 'application/xml' });
        const newFilename = originalFilename.startsWith('Reviewed_') ? originalFilename : `Reviewed_${originalFilename}`;

        saveAs(blob, newFilename);

    } catch (e) {
        console.error("Error processing bilingual file:", e);
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        alert(`Could not generate the corrected bilingual file. ${message}`);
    }
};

export const exportToDocx = async (
    originalFile: File,
    errorsToApply: QAError[],
    originalFilename: string
) => {
    try {
        const zip = await JSZip.loadAsync(originalFile);
        const docFile = zip.file('word/document.xml');

        if (!docFile) {
            throw new Error('Invalid DOCX file: word/document.xml not found.');
        }

        let docXml = await docFile.async('string');
        
        // Sort errors by their ID to apply them in the order they appear in the document.
        // This is a simple strategy to handle potentially overlapping corrections.
        const sortedErrors = [...errorsToApply].sort((a, b) => a.id - b.id);

        for (const error of sortedErrors) {
            // This is a "best-effort" replacement within the raw XML of the document.
            // It preserves formatting of the overall document, but it has limitations:
            // 1. It will not work if the `targetSegment` text is split across multiple XML tags 
            //    (e.g., due to partial formatting like "some **bold** text").
            // 2. It replaces only the first occurrence found in the XML from the top.
            // Despite these limitations, it's a major improvement as it no longer destroys the document's formatting.
            
            const replacementText = escapeXml(error.suggestedCorrection);

            // The text extracted from the DOCX (e.g., by mammoth.js) often normalizes various space characters
            // (like non-breaking spaces, U+00A0) into regular spaces (U+0020).
            // The original XML, however, retains the original characters.
            // To successfully find and replace the text, we must try replacing both the regular-space
            // version and a version with non-breaking spaces.

            // Variant 1: Text with regular spaces (as it likely appears in `error.targetSegment`).
            const sourceWithRegularSpaces = escapeXml(error.targetSegment);
            
            // Variant 2: Text with non-breaking spaces.
            const sourceWithNbsp = escapeXml(error.targetSegment.replace(/ /g, String.fromCharCode(160)));

            // A simple string replace is performed. It's not perfect but works for many cases.
            // We try the regular space version first. If no replacement occurs, we try the non-breaking space version.
            let tempXml = docXml.replace(sourceWithRegularSpaces, replacementText);
            
            if (tempXml === docXml) {
                // The regular space version was not found, try the NBSP version.
                tempXml = docXml.replace(sourceWithNbsp, replacementText);
            }
            
            docXml = tempXml;
        }

        // Update the zip with the modified XML
        zip.file('word/document.xml', docXml);

        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const newFilename = originalFilename.startsWith('Reviewed_') ? originalFilename : `Reviewed_${originalFilename}`;

        saveAs(blob, newFilename);

    } catch (e) {
        console.error("Error processing .docx file:", e);
        alert("Could not generate the corrected .docx file. The file may be corrupt or a correction could not be applied without breaking the document structure.");
    }
};