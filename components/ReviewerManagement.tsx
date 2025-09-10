import React, { useState } from 'react';
import { UserRole } from '../types';
import { SharingService } from '../services/sharingService';

interface ReviewerManagementProps {
  reportId: string;
  onReviewerAdded?: () => void;
}

export const ReviewerManagement: React.FC<ReviewerManagementProps> = ({ reportId, onReviewerAdded }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Reviewer);
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleAddReviewer = async () => {
    if (!email.trim()) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setIsAdding(true);
      await SharingService.addReviewer(reportId, email.trim(), name.trim() || undefined, role);
      
      // Reset form
      setEmail('');
      setName('');
      setRole(UserRole.Reviewer);
      setShowForm(false);
      
      // Notify parent component
      if (onReviewerAdded) {
        onReviewerAdded();
      }
      
      alert('✅ Reviewer added successfully!');
    } catch (error) {
      console.error('Failed to add reviewer:', error);
      const message = error instanceof Error ? error.message : 'Failed to add reviewer';
      alert(`❌ ${message}`);
    } finally {
      setIsAdding(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Reviewer
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Add Reviewer</h3>
        <button
          onClick={() => setShowForm(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="reviewer-email" className="block text-sm font-medium text-slate-700 mb-1">
            Email Address *
          </label>
          <input
            id="reviewer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@example.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isAdding}
          />
        </div>

        <div>
          <label htmlFor="reviewer-name" className="block text-sm font-medium text-slate-700 mb-1">
            Name (Optional)
          </label>
          <input
            id="reviewer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reviewer Name"
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isAdding}
          />
        </div>

        <div>
          <label htmlFor="reviewer-role" className="block text-sm font-medium text-slate-700 mb-1">
            Role
          </label>
          <select
            id="reviewer-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isAdding}
          >
            <option value={UserRole.Reviewer}>Reviewer</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Reviewers can view the report and make decisions on suggestions.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleAddReviewer}
          disabled={isAdding || !email.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAdding ? 'Adding...' : 'Add Reviewer'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          disabled={isAdding}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
