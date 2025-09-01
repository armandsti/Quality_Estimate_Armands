import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { TranslayLogo } from '../Icons'

export const AuthCallback: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('AuthCallback: Starting authentication callback...');
        console.log('AuthCallback: Current location:', window.location.href);
        console.log('AuthCallback: Location search:', location.search);
        
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('AuthCallback: Supabase error:', error);
          throw error
        }

        if (data.session) {
          console.log('AuthCallback: Session found, user authenticated');
          
          // Check if there's a redirect parameter
          const urlParams = new URLSearchParams(location.search)
          const redirectTo = urlParams.get('redirect')
          console.log('AuthCallback: Redirect parameter:', redirectTo);
          
          if (redirectTo) {
            console.log('AuthCallback: Redirecting to:', redirectTo);
            // Redirect to the specified path
            navigate(redirectTo, { replace: true })
          } else {
            console.log('AuthCallback: No redirect parameter, going to main app');
            // Successfully authenticated, redirect to main app
            navigate('/', { replace: true })
          }
        } else {
          console.log('AuthCallback: No session, redirecting to login');
          // No session, redirect to login
          navigate('/auth', { replace: true })
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setTimeout(() => {
          navigate('/auth', { replace: true })
        }, 3000)
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [navigate, location])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <TranslayLogo />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Translay</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Completing authentication...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Authentication Error</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
          <p className="text-sm text-slate-500 mb-4">Redirecting to login...</p>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
