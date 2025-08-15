
import React, { useState, useRef, useEffect } from 'react';
import { QAError, Severity } from '../types';
import { AcceptIcon, RejectIcon, PencilIcon, UndoIcon } from './Icons';

interface ResultsListProps {
  errors: QAError[];
  onApplyCorrection: (errorId: number) => void;
  onRejectCorrection: (errorId: number) => void;
  onSuggestionEdit: (errorId: number, newSuggestion: string) => void;
  onRevertCorrection: (errorId: number) => void;
}

const severityStyles: { [key in Severity]: { badge: string } } = {
  [Severity.Critical]: { badge: 'bg-red-100 text-red-800 border-red-300' },
  [Severity.Major]: { badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  [Severity.Minor]: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const styles = severityStyles[severity] || { badge: 'bg-slate-100 text-slate-800' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold border ${styles.badge}`}>
      {severity}
    </span>
  );
};

const Highlight: React.FC<{ text: string; highlight?: string; bgClass: string; }> = ({ text, highlight, bgClass }) => {
  if (!highlight || highlight.trim() === '') {
    return <>{text}</>;
  }

  // Create a set of highlights for efficient, case-insensitive lookup.
  const highlightParts = highlight.split('|').map(h => h.trim().toLowerCase()).filter(Boolean);
  if (highlightParts.length === 0) {
      return <>{text}</>;
  }

  // Create a regex that finds any of the highlight parts.
  const regex = new RegExp(`(${highlight.split('|').map(h => h.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|')})`, 'gi');
  
  if (!regex.test(text)) {
      return <>{text}</>;
  }
  
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        // Check if the current part is one of the highlights
        if (part && highlightParts.includes(part.toLowerCase())) {
          return (
            <mark key={i} className={`px-1 rounded ${bgClass}`}>
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
};


export const ResultsList: React.FC<ResultsListProps> = ({ errors, onApplyCorrection, onRejectCorrection, onSuggestionEdit, onRevertCorrection }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to recalculate
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editingText, editingId]);

  if (errors.length === 0) {
    return null;
  }
  
  const handleStartEdit = (error: QAError) => {
    if (!error.resolved && !error.rejected) {
      setEditingId(error.id);
      setEditingText(error.suggestedCorrection);
    }
  };

  const handleConfirmEdit = () => {
    if (editingId !== null && editingText.trim() !== '') {
      onSuggestionEdit(editingId, editingText);
    }
    setEditingId(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  return (
    <div className="flow-root">
      <div className="space-y-4">
        {/* Table Header */}
        <div className="flex text-xs font-bold uppercase text-slate-400 tracking-wider px-4 py-2">
            <div className="w-[90px] flex-shrink-0">SEVERITY</div>
            <div className="flex-1">SOURCE VS. TARGET</div>
            <div className="flex-1 pl-6">SUGGESTION & DETAILS</div>
            <div className="w-[120px] flex-shrink-0 text-center">ACTIONS</div>
        </div>
        
        {/* Error Cards */}
        {errors.map((error) => (
            <div 
                key={error.id} 
                className={`border rounded-lg flex items-start p-4 transition-all duration-300 ${
                    error.resolved ? 'bg-green-50/50 border-green-200' : 
                    error.rejected ? 'bg-red-50/50 border-red-200 opacity-60' : 
                    'bg-white border-slate-200'
                }`}
            >
                {/* Severity */}
                <div className="w-[90px] flex-shrink-0 pt-1">
                    <SeverityBadge severity={error.severity} />
                </div>
                
                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-2">
                    {error.segmentId && (
                        <div className="text-xs font-mono font-semibold text-slate-500 tracking-wide">
                           {error.segmentId.replace(/[\\[\\]]/g, '')}
                        </div>
                    )}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-md text-sm">
                        <span className="text-slate-500 font-semibold mr-2">SRC:</span>
                        <Highlight text={error.sourceSegment} highlight={error.sourceHighlight} bgClass="bg-blue-200/60 text-blue-900" />
                    </div>
                    <div className={`${error.resolved ? 'bg-green-50' : 'bg-red-50'} border ${error.resolved ? 'border-green-200' : 'border-red-200'} p-3 rounded-md text-sm`}>
                        <span className="text-slate-500 font-semibold mr-2">TGT:</span>
                        <Highlight text={error.targetSegment} highlight={error.targetHighlight} bgClass={`${error.resolved ? 'bg-green-300/60' : 'bg-red-200/60'} text-red-900`} />
                    </div>
                </div>

                {/* Suggestion & Description */}
                <div className="flex-1 pl-6 space-y-4 pt-1">
                    <div 
                        className={`group p-3 rounded-md text-sm transition-all duration-200 ${
                            editingId === error.id ? 'bg-white shadow-lg ring-2 ring-blue-500' : 'bg-green-50/50 border border-green-200'
                        }`}
                        onClick={() => handleStartEdit(error)}
                    >
                        {editingId === error.id ? (
                            <>
                                <span className="text-green-700 font-semibold mr-2">SUGGESTION:</span>
                                <textarea
                                    ref={textareaRef}
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onBlur={handleConfirmEdit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleConfirmEdit();
                                        }
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleCancelEdit();
                                        }
                                    }}
                                    autoFocus
                                    className="w-full p-1 mt-1 bg-white border-none rounded-md resize-none focus:outline-none block"
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </>
                        ) : (
                            <div className={`flex justify-between items-start ${!error.resolved && !error.rejected ? 'cursor-pointer' : ''}`}>
                                <div className="flex-grow pr-2">
                                    <span className="text-green-700 font-semibold mr-2">SUGGESTION:</span>
                                    <span className="inline">
                                        <Highlight text={error.suggestedCorrection} highlight={error.suggestionHighlight} bgClass="bg-green-300/60 text-green-900" />
                                    </span>
                                </div>
                                {!error.resolved && !error.rejected && (
                                    <div className="flex-shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" title="Edit suggestion">
                                        <PencilIcon />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">{error.errorCategory}</h4>
                        <p className="text-sm text-slate-600 mt-1">{error.description}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="w-[120px] flex-shrink-0 flex justify-center items-center">
                   {!error.resolved && !error.rejected ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onApplyCorrection(error.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-700 transition-colors"
                            aria-label="Accept suggestion"
                            title="Accept suggestion"
                        >
                            <AcceptIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onRejectCorrection(error.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 transition-colors"
                            aria-label="Reject suggestion"
                            title="Reject suggestion"
                        >
                            <RejectIcon className="h-5 w-5" />
                        </button>
                    </div>
                   ) : (
                    <div className="flex items-center gap-2">
                        {error.resolved && (
                           <span className="inline-flex items-center px-3 py-1 text-sm font-bold text-green-800 bg-green-200 rounded-full">
                               Accepted
                           </span>
                        )}
                        {error.rejected && (
                            <span className="inline-flex items-center px-3 py-1 text-sm font-bold text-red-800 bg-red-200 rounded-full">
                               Rejected
                           </span>
                        )}
                        <button
                            onClick={() => onRevertCorrection(error.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-800 transition-colors"
                            aria-label="Revert status"
                            title="Revert status"
                        >
                            <UndoIcon />
                        </button>
                    </div>
                   )}
                </div>
          </div>
        ))}
      </div>
    </div>
  );
};
