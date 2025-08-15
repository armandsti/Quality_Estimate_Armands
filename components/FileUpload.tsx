import React from 'react';
import { useState, useCallback } from 'react';
import { UploadIcon, DocumentIcon, XCircleIcon } from './Icons';

interface FileUploadProps {
  label: string;
  onFileChange: (file: File | null) => void;
  required?: boolean;
  file: File | null;
  compact?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileChange, required = false, file, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (selectedFile) {
        // Validation for supported types
        const supportedMimeTypes = [
            'application/pdf', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
            'text/plain',
            'image/jpeg',
            'application/xml',
            'text/xml'
        ];
        const supportedExtensions = ['.docx', '.pdf', '.txt', '.jpeg', '.jpg', '.xliff', '.xlf', '.tmx', '.xml', '.sdlxliff'];

        const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
        
        if (supportedMimeTypes.includes(selectedFile.type) || supportedExtensions.includes(fileExtension)) {
            onFileChange(selectedFile);
        } else {
            alert(`Unsupported file type: ${selectedFile.type || 'unknown'}. Please upload one of the supported formats: DOCX, PDF, TXT, JPEG, XLIFF, TMX, SDLXLIFF, XML.`);
            onFileChange(null);
        }
    } else {
        onFileChange(null);
    }
  }, [onFileChange]);
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    onFileChange(null);
    const input = document.getElementById(`file-upload-${label}`) as HTMLInputElement;
    if(input) input.value = '';
  };

  const emptyStateContent = compact ? (
    <label htmlFor={`file-upload-${label}`} className="flex items-center cursor-pointer w-full justify-center">
      <div className="text-slate-500 h-5 w-5 flex-shrink-0"><UploadIcon/></div>
      <span className="ml-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-500">Upload file</span>
      <input id={`file-upload-${label}`} name={`file-upload-${label}`} type="file" className="sr-only" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)} accept=".docx,.pdf,.txt,.jpeg,.jpg,.xliff,.xlf,.tmx,.xml,.sdlxliff"/>
    </label>
  ) : (
    <div className="text-center">
      <div className="text-slate-500 mx-auto h-8 w-8"><UploadIcon/></div>
      <div className="flex text-sm text-slate-600">
        <label htmlFor={`file-upload-${label}`} className="relative cursor-pointer bg-white rounded-md font-semibold text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
          <span>Upload a file</span>
          <input id={`file-upload-${label}`} name={`file-upload-${label}`} type="file" className="sr-only" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)} accept=".docx,.pdf,.txt,.jpeg,.jpg,.xliff,.xlf,.tmx,.xml,.sdlxliff"/>
        </label>
        <p className="pl-1">or drag and drop</p>
      </div>
      <p className="text-xs text-slate-500">DOCX, PDF, TXT, JPEG, XLIFF, TMX, SDLXLIFF</p>
    </div>
  );

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {file ? (
        <div className={`flex items-center justify-between bg-slate-100 border border-slate-300 rounded-lg ${compact ? 'p-2' : 'p-2.5'}`}>
          <div className="flex items-center gap-2 text-sm text-slate-700 truncate">
            <DocumentIcon />
            <span className="truncate">{file.name}</span>
          </div>
          <button onClick={handleRemoveFile} className="text-slate-500 hover:text-red-600">
            <XCircleIcon />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`group flex justify-center items-center w-full border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors ${isDragging ? 'border-indigo-600 bg-indigo-100' : 'bg-white'} ${compact ? 'px-3 py-2' : 'px-6 py-4'}`}
        >
          {emptyStateContent}
        </div>
      )}
    </div>
  );
};
