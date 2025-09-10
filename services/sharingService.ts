import { supabase, TABLES } from '../lib/supabase';
import { 
  QAError, 
  SharedReportData, 
  WorkflowStatus, 
  UserRole, 
  DatabaseSharedReport,
  DatabaseSharedReportReviewer,
  DatabaseSharedReportDecision,
  AuthUser 
} from '../types';

export class SharingService {
  // Generate a shareable link for a QA report
  static async generateShareableLink(
    historyEntryId: string,
    errors: QAError[],
    sourceFileName: string,
    targetFileName?: string,
    metadata?: any,
    creator?: AuthUser
  ): Promise<string> {
    try {
      if (!creator) {
        throw new Error('User authentication required');
      }

      if (!historyEntryId) {
        throw new Error('History entry ID is required');
      }

      // Validate that the history entry exists and belongs to the user
      const { data: historyEntry, error: historyCheckError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .select('id, user_id')
        .eq('id', historyEntryId)
        .eq('user_id', creator.id)
        .single();

      if (historyCheckError || !historyEntry) {
        console.error('History entry validation failed:', historyCheckError);
        throw new Error(`Invalid history entry: The analysis must be saved to the database before it can be shared.`);
      }

      console.log('History entry validated:', historyEntry.id);

      // Create shared report record
      const sharedReportData: Omit<DatabaseSharedReport, 'id' | 'created_at' | 'updated_at'> = {
        history_entry_id: historyEntryId,
        creator_id: creator.id,
        workflow_status: WorkflowStatus.Shared
      };

      console.log('Creating shared report with data:', sharedReportData);

      const { data: sharedReport, error: reportError } = await supabase
        .from(TABLES.SHARED_REPORTS)
        .insert([sharedReportData])
        .select()
        .single();

      console.log('Shared report creation result:', { sharedReport, reportError });

      if (reportError) {
        throw new Error(`Failed to create shared report: ${reportError.message}`);
      }

      // Update the original history entry with the shared report ID
      const { error: historyUpdateError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .update({ 
          shared_report_id: sharedReport.id,
          workflow_status: WorkflowStatus.Shared 
        })
        .eq('id', historyEntryId)
        .eq('user_id', creator.id);

      if (historyUpdateError) {
        console.error('Failed to update history entry:', historyUpdateError);
        // Don't throw error here as the shared report was created successfully
      }

      // Generate the shareable URL
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/shared-report/${sharedReport.id}`;

      console.log('URL Generation Details:', {
        baseUrl,
        reportId: sharedReport.id,
        fullUrl: shareUrl,
        windowLocation: window.location.href
      });

      // Validate the URL format
      if (!shareUrl.includes('/shared-report/') || !sharedReport.id) {
        throw new Error(`Invalid URL generated: ${shareUrl}`);
      }

      console.log('Generated shareable link:', shareUrl);
      return shareUrl;
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      throw error;
    }
  }

  // Get shared report data
  static async getSharedReport(reportId: string, userId?: string): Promise<SharedReportData | null> {
    try {
      // First get the shared report record
      const { data: sharedReport, error: reportError } = await supabase
        .from(TABLES.SHARED_REPORTS)
        .select(`
          *,
          ${TABLES.SHARED_REPORT_REVIEWERS} (*),
          ${TABLES.SHARED_REPORT_DECISIONS} (*)
        `)
        .eq('id', reportId)
        .single();

      if (reportError || !sharedReport) {
        console.error('Shared report not found:', reportError);
        return null;
      }

      // Get the original analysis history and errors
      const { data: historyData, error: historyError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .select(`
          *,
          ${TABLES.ANALYSIS_ERRORS} (*),
          profiles!analysis_history_user_id_fkey (*)
        `)
        .eq('id', sharedReport.history_entry_id)
        .single();

      if (historyError || !historyData) {
        console.error('Original history not found:', historyError);
        return null;
      }

      // Check if user has access (creator or reviewer)
      if (userId) {
        const isCreator = historyData.user_id === userId;
        const isReviewer = sharedReport.shared_report_reviewers?.some((r: any) => r.reviewer_id === userId);
        const hasAccess = isCreator || isReviewer;
        
        console.log('Access check:', { userId, isCreator, isReviewer, hasAccess });
        
        if (!hasAccess) {
          console.error('User does not have access to this report');
          return null;
        }
      }

      // Transform database data to SharedReportData format
      const errors: QAError[] = historyData.analysis_errors?.map((error: any) => ({
        id: error.id,
        segmentId: error.segment_id,
        sourceSegment: error.source_segment,
        targetSegment: error.target_segment,
        sourceHighlight: error.source_highlight,
        targetHighlight: error.target_highlight,
        errorCategory: error.error_category,
        errorType: error.error_type,
        description: error.description,
        suggestedCorrection: error.suggested_correction,
        suggestionHighlight: error.suggestion_highlight,
        severity: error.severity,
        resolved: error.resolved,
        rejected: error.rejected,
      })) || [];

      // Transform decisions
      const decisions: Record<string, any> = {};
      sharedReport.shared_report_decisions?.forEach((decision: any) => {
        decisions[decision.error_id] = {
          accepted: decision.accepted,
          rejected: decision.rejected,
          decidedBy: decision.decided_by,
          decidedAt: decision.decided_at,
          comment: decision.comment
        };
      });

      // Build the shared report data
      const sharedReportData: SharedReportData = {
        id: sharedReport.id,
        historyEntryId: sharedReport.history_entry_id,
        timestamp: sharedReport.created_at,
        errors,
        sourceFileName: historyData.source_file_name,
        targetFileName: historyData.target_file_name || '',
        metadata: {},
        summary: {
          totalIssues: errors.length,
          criticalCount: errors.filter(e => e.severity === 'Critical').length,
          majorCount: errors.filter(e => e.severity === 'Major').length,
          minorCount: errors.filter(e => e.severity === 'Minor').length,
        },
        workflowStatus: sharedReport.workflow_status,
        creator: {
          id: historyData.user_id,
          email: historyData.profiles?.email || 'Unknown',
          name: historyData.profiles?.full_name
        },
        reviewers: sharedReport.shared_report_reviewers?.map((reviewer: any) => ({
          id: reviewer.reviewer_id,
          email: reviewer.reviewer_email,
          name: reviewer.reviewer_name,
          role: reviewer.role,
          invitedAt: reviewer.invited_at,
          lastViewedAt: reviewer.last_viewed_at,
          completedAt: reviewer.completed_at
        })) || [],
        decisions
      };

      return sharedReportData;
    } catch (error) {
      console.error('Failed to get shared report:', error);
      return null;
    }
  }

  // Add reviewer to shared report
  static async addReviewer(
    reportId: string, 
    reviewerEmail: string, 
    reviewerName?: string, 
    role: UserRole = UserRole.Reviewer
  ): Promise<void> {
    try {
      // First, try to find the user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', reviewerEmail)
        .single();

      let reviewerId = userData?.id;

      // If user doesn't exist, we'll still create the reviewer record with null reviewer_id
      // They can be linked later when they sign up
      if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.warn('Error finding user by email:', userError);
      }

      const reviewerData: Omit<DatabaseSharedReportReviewer, 'id' | 'created_at' | 'updated_at'> = {
        shared_report_id: reportId,
        reviewer_id: reviewerId || '', // Will be empty if user doesn't exist yet
        reviewer_email: reviewerEmail,
        reviewer_name: reviewerName || userData?.full_name,
        role,
        invited_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from(TABLES.SHARED_REPORT_REVIEWERS)
        .insert([reviewerData]);

      if (error) {
        throw new Error(`Failed to add reviewer: ${error.message}`);
      }

      console.log('Reviewer added successfully:', reviewerEmail);
    } catch (error) {
      console.error('Failed to add reviewer:', error);
      throw error;
    }
  }

  // Update report viewer tracking
  static async updateReportViewer(reportId: string, viewer: {
    id: string;
    email: string;
    name?: string;
  }): Promise<void> {
    try {
      // Update the last viewed timestamp for the reviewer
      const { error } = await supabase
        .from(TABLES.SHARED_REPORT_REVIEWERS)
        .update({ 
          last_viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('shared_report_id', reportId)
        .eq('reviewer_id', viewer.id);

      if (error) {
        console.warn('Failed to update viewer tracking:', error);
      }
    } catch (error) {
      console.error('Failed to update report viewer:', error);
    }
  }

  // Update or create decision for an error
  static async updateReportDecision(
    reportId: string, 
    errorId: string, 
    decision: {
      accepted: boolean;
      rejected: boolean;
      decidedBy: string;
      decidedAt: string;
      comment?: string;
    }
  ): Promise<void> {
    try {
      // Validate input parameters
      if (!reportId || !errorId) {
        throw new Error('Report ID and Error ID are required');
      }

      const decisionData: Omit<DatabaseSharedReportDecision, 'id' | 'created_at' | 'updated_at'> = {
        shared_report_id: reportId,
        error_id: errorId,
        accepted: decision.accepted,
        rejected: decision.rejected,
        decided_by: decision.decidedBy,
        decided_at: decision.decidedAt,
        comment: decision.comment
      };

      console.log('Updating decision:', { reportId, errorId, decisionData });

      // First try to update existing decision
      const { data: existingDecision, error: selectError } = await supabase
        .from(TABLES.SHARED_REPORT_DECISIONS)
        .select('id')
        .eq('shared_report_id', reportId)
        .eq('error_id', errorId)
        .single();

      let error;
      if (existingDecision) {
        // Update existing decision
        const { error: updateError } = await supabase
          .from(TABLES.SHARED_REPORT_DECISIONS)
          .update(decisionData)
          .eq('shared_report_id', reportId)
          .eq('error_id', errorId);

        error = updateError;
        console.log('Updated existing decision for error:', errorId);
      } else {
        // Insert new decision
        const { error: insertError } = await supabase
          .from(TABLES.SHARED_REPORT_DECISIONS)
          .insert([decisionData]);

        error = insertError;
        console.log('Inserted new decision for error:', errorId);
      }

      if (error) {
        console.error('Supabase error updating decision:', error);
        throw new Error(`Failed to update decision: ${error.message}`);
      }

      console.log('Decision updated successfully for error:', errorId);
    } catch (error) {
      console.error('Failed to update report decision:', error);
      throw error;
    }
  }

  // Mark report as completed by a reviewer
  static async markReportCompleted(reportId: string, reviewerId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.SHARED_REPORT_REVIEWERS)
        .update({ 
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('shared_report_id', reportId)
        .eq('reviewer_id', reviewerId);

      if (error) {
        throw new Error(`Failed to mark report as completed: ${error.message}`);
      }

      // Check if all reviewers have completed
      const { data: reviewers, error: reviewersError } = await supabase
        .from(TABLES.SHARED_REPORT_REVIEWERS)
        .select('completed_at')
        .eq('shared_report_id', reportId);

      if (reviewersError) {
        console.warn('Failed to check completion status:', reviewersError);
        return;
      }

      const allCompleted = reviewers?.every(r => r.completed_at !== null);
      
      if (allCompleted) {
        // Update the shared report status to completed
        const { error: updateError } = await supabase
          .from(TABLES.SHARED_REPORTS)
          .update({ 
            workflow_status: WorkflowStatus.Completed,
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);

        if (updateError) {
          console.warn('Failed to update report status:', updateError);
        }
      }

      console.log('Report marked as completed by reviewer:', reviewerId);
    } catch (error) {
      console.error('Failed to mark report as completed:', error);
      throw error;
    }
  }

  // Subscribe to real-time changes for a shared report
  static subscribeToReportChanges(
    reportId: string, 
    onDecisionChange: (decision: any) => void,
    onReviewerChange: (reviewer: any) => void,
    onStatusChange: (status: WorkflowStatus) => void
  ) {
    console.log('Setting up real-time subscriptions for report:', reportId);

    // Subscribe to decision changes
    const decisionsSubscription = supabase
      .channel(`shared_report_decisions:${reportId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.SHARED_REPORT_DECISIONS,
          filter: `shared_report_id=eq.${reportId}`
        },
        (payload) => {
          console.log('Decision change received:', payload);
          try {
            onDecisionChange(payload.new || payload.old);
          } catch (error) {
            console.error('Error handling decision change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Decisions subscription status:', status);
      });

    // Subscribe to reviewer changes
    const reviewersSubscription = supabase
      .channel(`shared_report_reviewers:${reportId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.SHARED_REPORT_REVIEWERS,
          filter: `shared_report_id=eq.${reportId}`
        },
        (payload) => {
          console.log('Reviewer change received:', payload);
          try {
            onReviewerChange(payload.new || payload.old);
          } catch (error) {
            console.error('Error handling reviewer change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Reviewers subscription status:', status);
      });

    // Subscribe to report status changes
    const reportSubscription = supabase
      .channel(`shared_reports:${reportId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: TABLES.SHARED_REPORTS,
          filter: `id=eq.${reportId}`
        },
        (payload) => {
          console.log('Report status change received:', payload);
          try {
            if (payload.new?.workflow_status) {
              onStatusChange(payload.new.workflow_status);
            }
          } catch (error) {
            console.error('Error handling status change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Report subscription status:', status);
      });

    // Return cleanup function
    return () => {
      console.log('Cleaning up real-time subscriptions for report:', reportId);
      supabase.removeChannel(decisionsSubscription);
      supabase.removeChannel(reviewersSubscription);
      supabase.removeChannel(reportSubscription);
    };
  }

  // Get all shared reports for a user (as creator or reviewer)
  static async getUserSharedReports(userId: string): Promise<SharedReportData[]> {
    try {
      // Get reports where user is creator
      const { data: createdReports, error: createdError } = await supabase
        .from(TABLES.SHARED_REPORTS)
        .select(`
          *,
          ${TABLES.SHARED_REPORT_REVIEWERS} (*),
          ${TABLES.SHARED_REPORT_DECISIONS} (*),
          ${TABLES.ANALYSIS_HISTORY} (
            *,
            ${TABLES.ANALYSIS_ERRORS} (*),
            profiles!analysis_history_user_id_fkey (*)
          )
        `)
        .eq('creator_id', userId);

      // Get reports where user is reviewer
      const { data: reviewedReports, error: reviewedError } = await supabase
        .from(TABLES.SHARED_REPORT_REVIEWERS)
        .select(`
          ${TABLES.SHARED_REPORTS} (
            *,
            ${TABLES.SHARED_REPORT_REVIEWERS} (*),
            ${TABLES.SHARED_REPORT_DECISIONS} (*),
            ${TABLES.ANALYSIS_HISTORY} (
              *,
              ${TABLES.ANALYSIS_ERRORS} (*),
              profiles!analysis_history_user_id_fkey (*)
            )
          )
        `)
        .eq('reviewer_id', userId);

      if (createdError) {
        console.error('Failed to fetch created reports:', createdError);
      }
      if (reviewedError) {
        console.error('Failed to fetch reviewed reports:', reviewedError);
      }

      const allReports = [
        ...(createdReports || []),
        ...(reviewedReports?.map(r => r.shared_reports).filter(Boolean) || [])
      ];

      // Transform to SharedReportData format
      return allReports.map(report => this.transformDatabaseToSharedReport(report));
    } catch (error) {
      console.error('Failed to get user shared reports:', error);
      return [];
    }
  }

  // Helper method to transform database format to SharedReportData
  private static transformDatabaseToSharedReport(report: any): SharedReportData {
    const historyData = report.analysis_history;
    const errors: QAError[] = historyData?.analysis_errors?.map((error: any) => ({
      id: error.id,
      segmentId: error.segment_id,
      sourceSegment: error.source_segment,
      targetSegment: error.target_segment,
      sourceHighlight: error.source_highlight,
      targetHighlight: error.target_highlight,
      errorCategory: error.error_category,
      errorType: error.error_type,
      description: error.description,
      suggestedCorrection: error.suggested_correction,
      suggestionHighlight: error.suggestion_highlight,
      severity: error.severity,
      resolved: error.resolved,
      rejected: error.rejected,
    })) || [];

    const decisions: Record<string, any> = {};
    report.shared_report_decisions?.forEach((decision: any) => {
      decisions[decision.error_id] = {
        accepted: decision.accepted,
        rejected: decision.rejected,
        decidedBy: decision.decided_by,
        decidedAt: decision.decided_at,
        comment: decision.comment
      };
    });

    return {
      id: report.id,
      historyEntryId: report.history_entry_id,
      timestamp: report.created_at,
      errors,
      sourceFileName: historyData?.source_file_name || 'Unknown',
      targetFileName: historyData?.target_file_name || '',
      metadata: {},
      summary: {
        totalIssues: errors.length,
        criticalCount: errors.filter(e => e.severity === 'Critical').length,
        majorCount: errors.filter(e => e.severity === 'Major').length,
        minorCount: errors.filter(e => e.severity === 'Minor').length,
      },
      workflowStatus: report.workflow_status,
      creator: {
        id: historyData?.user_id || '',
        email: historyData?.profiles?.email || 'Unknown',
        name: historyData?.profiles?.full_name
      },
      reviewers: report.shared_report_reviewers?.map((reviewer: any) => ({
        id: reviewer.reviewer_id,
        email: reviewer.reviewer_email,
        name: reviewer.reviewer_name,
        role: reviewer.role,
        invitedAt: reviewer.invited_at,
        lastViewedAt: reviewer.last_viewed_at,
        completedAt: reviewer.completed_at
      })) || [],
      decisions
    };
  }
}
