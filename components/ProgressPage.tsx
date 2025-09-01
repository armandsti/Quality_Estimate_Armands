import React from 'react';
import { Loader } from './Loader';

interface ProgressPageProps {
  sourceFileName?: string;
  targetFileName?: string;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({ 
  sourceFileName, 
  targetFileName 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-b-xl">
      <Loader />
      <p className="mt-4 text-slate-600 font-semibold">
        OpenAI GPT-4o-mini is analyzing the translation...
      </p>
      <p className="text-sm text-slate-500">
        This may take a moment for large files.
      </p>
      {(sourceFileName || targetFileName) && (
        <div className="mt-4 text-left text-sm text-slate-600">
          {sourceFileName && <p><strong>Source File:</strong> {sourceFileName}</p>}
          {targetFileName && <p><strong>Target File:</strong> {targetFileName}</p>}
        </div>
      )}
    </div>
  );
};
