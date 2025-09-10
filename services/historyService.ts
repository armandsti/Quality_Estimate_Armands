import { supabase, TABLES } from '../lib/supabase'
import {
  HistoryEntry,
  DatabaseHistoryEntry,
  DatabaseAnalysisError,
  QAError,
  Severity,
  WorkflowStatus
} from '../types'

export class HistoryService {
  // Save analysis history to database
  static async saveAnalysisHistory(
    userId: string,
    sourceFileName: string,
    targetFileName: string | undefined,
    sourceContent: string,
    targetContent: string,
    errors: QAError[]
  ): Promise<string> {
    try {
      // Calculate severity counts
      const severityCounts = {
        [Severity.Critical]: errors.filter(e => e.severity === Severity.Critical).length,
        [Severity.Major]: errors.filter(e => e.severity === Severity.Major).length,
        [Severity.Minor]: errors.filter(e => e.severity === Severity.Minor).length,
      }

      const confirmedCount = errors.filter(e => e.resolved).length
      const rejectedCount = errors.filter(e => e.rejected).length

      // Create history entry
      const historyEntry: Omit<DatabaseHistoryEntry, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        source_file_name: sourceFileName,
        target_file_name: targetFileName,
        source_file_content: sourceContent,
        target_file_content: targetContent,
        error_count: errors.length,
        severity_counts: severityCounts,
        confirmed_count: confirmedCount,
        rejected_count: rejectedCount,
        workflow_status: 'draft' as WorkflowStatus,
        shared_report_id: null,
      }

      const { data: historyData, error: historyError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .insert([historyEntry])
        .select()
        .single()

      if (historyError) {
        throw new Error(`Failed to save history: ${historyError.message}`)
      }

      // Save individual errors
      if (errors.length > 0) {
        const analysisErrors: Omit<DatabaseAnalysisError, 'id' | 'created_at' | 'updated_at'>[] = errors.map(error => ({
          history_entry_id: historyData.id,
          segment_id: error.segmentId,
          source_segment: error.sourceSegment,
          target_segment: error.targetSegment,
          source_highlight: error.sourceHighlight,
          target_highlight: error.targetHighlight,
          error_category: error.errorCategory,
          error_type: error.errorType,
          description: error.description,
          suggested_correction: error.suggestedCorrection,
          suggestion_highlight: error.suggestionHighlight,
          severity: error.severity,
          resolved: error.resolved || false,
          rejected: error.rejected || false,
        }))

        const { error: errorsError } = await supabase
          .from(TABLES.ANALYSIS_ERRORS)
          .insert(analysisErrors)

        if (errorsError) {
          console.error('Failed to save errors:', errorsError)
          // Don't throw here as the history was saved successfully
        }
      }

      return historyData.id
    } catch (error) {
      console.error('Error saving analysis history:', error)
      throw error
    }
  }

  // Get user's analysis history from database
  static async getAnalysisHistory(userId: string): Promise<HistoryEntry[]> {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .select(`
          *,
          ${TABLES.ANALYSIS_ERRORS} (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (historyError) {
        throw new Error(`Failed to fetch history: ${historyError.message}`)
      }

      if (!historyData) return []

      // Transform database format to app format
      return historyData.map(entry => ({
        id: entry.id,
        date: entry.created_at,
        sourceFileName: entry.source_file_name,
        targetFileName: entry.target_file_name,
        errorCount: entry.error_count,
        errors: entry.analysis_errors?.map(error => ({
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
        })) || [],
        severityCounts: entry.severity_counts,
        confirmedCount: entry.confirmed_count,
        rejectedCount: entry.rejected_count,
        workflowStatus: entry.workflow_status as WorkflowStatus,
        sharedReportId: entry.shared_report_id,
      }))
    } catch (error) {
      console.error('Error fetching analysis history:', error)
      throw error
    }
  }

  // Update error resolution status
  static async updateErrorStatus(
    errorId: string,
    resolved: boolean,
    rejected: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.ANALYSIS_ERRORS)
        .update({
          resolved,
          rejected,
          updated_at: new Date().toISOString()
        })
        .eq('id', errorId)

      if (error) {
        throw new Error(`Failed to update error: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating error status:', error)
      throw error
    }
  }

  // Update workflow status
  static async updateWorkflowStatus(historyId: string, status: WorkflowStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .update({
          workflow_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', historyId)

      if (error) {
        throw new Error(`Failed to update workflow status: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating workflow status:', error)
      throw error
    }
  }

  // Update shared report ID
  static async updateSharedReportId(historyId: string, sharedReportId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .update({
          shared_report_id: sharedReportId,
          updated_at: new Date().toISOString()
        })
        .eq('id', historyId)

      if (error) {
        throw new Error(`Failed to update shared report ID: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating shared report ID:', error)
      throw error
    }
  }

  // Update history entry with latest data
  static async updateHistoryEntry(entry: any): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .update({
          workflow_status: entry.workflowStatus || 'draft',
          shared_report_id: entry.sharedReportId,
          confirmed_count: entry.confirmedCount || 0,
          rejected_count: entry.rejectedCount || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)

      if (error) {
        throw new Error(`Failed to update history entry: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating history entry:', error)
      throw error
    }
  }

  // Delete analysis history entry
  static async deleteAnalysisHistory(historyId: string): Promise<void> {
    try {
      // Delete associated errors first
      const { error: errorsError } = await supabase
        .from(TABLES.ANALYSIS_ERRORS)
        .delete()
        .eq('history_entry_id', historyId)

      if (errorsError) {
        console.error('Failed to delete errors:', errorsError)
      }

      // Delete history entry
      const { error: historyError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .delete()
        .eq('id', historyId)

      if (historyError) {
        throw new Error(`Failed to delete history: ${historyError.message}`)
      }
    } catch (error) {
      console.error('Error deleting analysis history:', error)
      throw error
    }
  }

  // Get analysis statistics for user
  static async getAnalysisStats(userId: string): Promise<{
    totalAnalyses: number
    totalErrors: number
    averageErrorsPerAnalysis: number
    mostCommonErrorCategory: string
  }> {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from(TABLES.ANALYSIS_HISTORY)
        .select('id, error_count')
        .eq('user_id', userId)

      if (historyError) {
        throw new Error(`Failed to fetch stats: ${historyError.message}`)
      }

      if (!historyData || historyData.length === 0) {
        return {
          totalAnalyses: 0,
          totalErrors: 0,
          averageErrorsPerAnalysis: 0,
          mostCommonErrorCategory: 'None'
        }
      }

      const totalAnalyses = historyData.length
      const totalErrors = historyData.reduce((sum, entry) => sum + entry.error_count, 0)
      const averageErrorsPerAnalysis = totalErrors / totalAnalyses

      // Get most common error category
      const { data: categoryData, error: categoryError } = await supabase
        .from(TABLES.ANALYSIS_ERRORS)
        .select('error_category')
        .eq('history_entry_id', historyData[0]?.id || '') // Just get from one entry for now

      let mostCommonErrorCategory = 'None'
      if (categoryData && categoryData.length > 0) {
        const categories = categoryData.map(e => e.error_category)
        const categoryCounts = categories.reduce((acc, category) => {
          acc[category] = (acc[category] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        mostCommonErrorCategory = Object.entries(categoryCounts)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'None'
      }

      return {
        totalAnalyses,
        totalErrors,
        averageErrorsPerAnalysis: Math.round(averageErrorsPerAnalysis * 100) / 100,
        mostCommonErrorCategory
      }
    } catch (error) {
      console.error('Error fetching analysis stats:', error)
      throw error
    }
  }
}
