import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

// Import the current App's state management
import { useAuth } from '../contexts/AuthContext';

// Get global statistics from localStorage - separate from user history
const getGlobalStats = (): any => {
  try {
    const stored = localStorage.getItem('globalQAStats');
    return stored ? JSON.parse(stored) : {
      totalSegments: 0,
      confirmed: 0,
      rejected: 0,
      edited: 0,
      totalReports: 0,
      lastUpdated: null
    };
  } catch {
    return {
      totalSegments: 0,
      confirmed: 0,
      rejected: 0,
      edited: 0,
      totalReports: 0,
      lastUpdated: null
    };
  }
};

// Global statistics update function that can be called from other components
export const updateGlobalStatistics = (action: 'accept' | 'reject' | 'edit_clicked' | 'new_report') => {
  try {
    const currentStats = getGlobalStats();
    const updatedStats = { ...currentStats };
    
    switch (action) {
      case 'accept':
        updatedStats.confirmed += 1;
        break;
      case 'reject':
        updatedStats.rejected += 1;
        break;
      case 'edit_clicked':
        updatedStats.edited += 1;
        break;
      case 'new_report':
        updatedStats.totalReports += 1;
        break;
    }
    
    updatedStats.lastUpdated = new Date().toISOString();
    localStorage.setItem('globalQAStats', JSON.stringify(updatedStats));
  } catch (error) {
    console.error('Failed to update global statistics:', error);
  }
};

export const StatisticsPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  // Only show on history page and when user is authenticated
  if (location.pathname !== '/history' || !user) {
    return null;
  }

  // Get current user's history to calculate new contributions
  const getCurrentUserHistory = (): any[] => {
    try {
      const stored = localStorage.getItem('translationHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Calculate current user's contributions
  const currentUserHistory = getCurrentUserHistory();
  const currentUserStats = {
    totalSegments: currentUserHistory.reduce((sum, entry) => sum + (entry.errorCount || 0), 0),
    confirmed: currentUserHistory.reduce((sum, entry) => {
      if (entry.errors) {
        return sum + entry.errors.filter((e: any) => e.resolved).length;
      }
      return sum + (entry.confirmedCount || 0);
    }, 0),
    rejected: currentUserHistory.reduce((sum, entry) => {
      if (entry.errors) {
        return sum + entry.errors.filter((e: any) => e.rejected).length;
      }
      return sum + (entry.rejectedCount || 0);
    }, 0),
    edited: currentUserHistory.reduce((sum, entry) => {
      if (entry.errors) {
        const editedInEntry = entry.errors.filter((e: any) => 
          e.suggestedCorrection && e.suggestedCorrection !== e.targetSegment
        ).length;
        return sum + editedInEntry;
      }
      return sum;
    }, 0),
    totalReports: currentUserHistory.length,
  };

  // Get global statistics
  const globalStats = getGlobalStats();

  // Calculate total statistics (global + current user)
  const totalStats = {
    totalSegments: globalStats.totalSegments + currentUserStats.totalSegments,
    confirmed: globalStats.confirmed + currentUserStats.confirmed,
    rejected: globalStats.rejected + currentUserStats.rejected,
    edited: globalStats.edited + currentUserStats.edited,
    totalReports: globalStats.totalReports + currentUserStats.totalReports,
  };

  // Calculate acceptance rate
  const acceptanceRate = totalStats.totalSegments > 0 
    ? Math.round((totalStats.confirmed / totalStats.totalSegments) * 100)
    : 0;

  return (
    <div 
      className="relative mt-8 mb-4 flex justify-end"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Subtle trigger area - very small and barely visible */}
      <div className="w-8 h-8 bg-transparent border border-slate-200/30 rounded-full flex items-center justify-center opacity-20 hover:opacity-60 transition-opacity duration-300 cursor-pointer">
        <span className="text-slate-400 text-[10px]">📊</span>
      </div>
      
      {/* Statistics panel - appears on hover */}
      {isVisible && (
        <div className="absolute bottom-0 right-0 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-lg p-3 min-w-[220px] animate-in slide-in-from-bottom-2 duration-300">
          <div className="text-xs text-slate-500 mb-2 font-medium">
            Global Statistics
          </div>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Segments:</span>
              <span className="font-mono text-slate-800 font-semibold">{totalStats.totalSegments.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600">✅ Accepted:</span>
              <span className="font-mono text-green-600 font-semibold">{totalStats.confirmed.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600">❌ Rejected:</span>
              <span className="font-mono text-red-600 font-semibold">{totalStats.rejected.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600">✏️ Edit Clicks:</span>
              <span className="font-mono text-blue-600 font-semibold">{totalStats.edited.toLocaleString()}</span>
            </div>
            
            <div className="border-t border-slate-200 pt-1 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-600">📊 Reports:</span>
                <span className="font-mono text-slate-800 font-semibold">{totalStats.totalReports.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-1 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Acceptance Rate:</span>
                <span className="font-mono text-green-600 font-semibold">{acceptanceRate}%</span>
              </div>
            </div>
          </div>
          
          <div className="text-[10px] text-slate-400 mt-2 text-center">
            System-wide benchmark
          </div>
        </div>
      )}
    </div>
  );
};
