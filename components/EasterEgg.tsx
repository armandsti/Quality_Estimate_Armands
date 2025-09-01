import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

// Import the current App's state management
import { useAuth } from '../contexts/AuthContext';

export const StatisticsPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  // Only show on history page and when user is authenticated
  if (location.pathname !== '/history' || !user) {
    return null;
  }

  // Get history from localStorage since we're not using Zustand
  const getHistoryFromStorage = (): any[] => {
    try {
      const stored = localStorage.getItem('translationHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const historyEntries = getHistoryFromStorage();

  // Calculate app-wide statistics from history entries
  const stats = {
    totalSegments: historyEntries.reduce((sum, entry) => sum + (entry.errorCount || 0), 0),
    confirmed: historyEntries.reduce((sum, entry) => {
      if (entry.errors) {
        return sum + entry.errors.filter((e: any) => e.resolved).length;
      }
      return sum + (entry.confirmedCount || 0);
    }, 0),
    rejected: historyEntries.reduce((sum, entry) => {
      if (entry.errors) {
        return sum + entry.errors.filter((e: any) => e.rejected).length;
      }
      return sum + (entry.rejectedCount || 0);
    }, 0),
    edited: historyEntries.reduce((sum, entry) => {
      if (entry.errors) {
        const editedInEntry = entry.errors.filter((e: any) => 
          e.suggestedCorrection && e.suggestedCorrection !== e.targetSegment
        ).length;
        return sum + editedInEntry;
      }
      return sum;
    }, 0),
    totalReports: historyEntries.length,
  };

  return (
    <div 
      className="fixed top-4 right-4 z-50"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Statistics panel - always visible */}
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-4 min-w-[220px]">
        <div className="text-xs text-slate-500 mb-3 font-medium">
          📊 Statistics
        </div>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Total Segments:</span>
            <span className="font-mono text-slate-800 font-semibold">{stats.totalSegments}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-600">✅ Confirmed:</span>
            <span className="font-mono text-green-600 font-semibold">{stats.confirmed}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-600">❌ Rejected:</span>
            <span className="font-mono text-red-600 font-semibold">{stats.rejected}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-600">✏️ Edited:</span>
            <span className="font-mono text-blue-600 font-semibold">{stats.edited}</span>
          </div>
          
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-slate-600">📊 Total Reports:</span>
              <span className="font-mono text-slate-800 font-semibold">{stats.totalReports}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
