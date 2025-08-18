import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserProfile } from '../types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  // Traditional auth
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  // Google OAuth
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  // Profile management
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('AuthContext: Starting authentication check...');
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('AuthContext: Timeout reached, forcing loading to false');
      setLoading(false);
    }, 5000); // Reduced to 5 seconds
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthContext: Initial session check:', session ? 'Session found' : 'No session', 'Error:', error);
      
      if (error) {
        console.error('AuthContext: Error getting session:', error);
        setLoading(false);
        return;
      }
      
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('AuthContext: User found, fetching profile...');
        fetchProfile(session.user.id).finally(() => {
          setLoading(false);
          console.log('AuthContext: Profile fetch complete, loading set to false');
        });
      } else {
        setLoading(false)
        console.log('AuthContext: No session, loading set to false');
      }
      clearTimeout(timeoutId);
    }).catch(error => {
      console.error('AuthContext: Exception getting session:', error);
      setLoading(false);
      clearTimeout(timeoutId);
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state change event:', event, session ? 'Session present' : 'No session');
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('AuthContext: User authenticated, fetching profile...');
          fetchProfile(session.user.id).finally(() => {
            setLoading(false);
            console.log('AuthContext: Profile fetch complete, loading set to false');
          });
        } else {
          console.log('AuthContext: No user, clearing profile');
          setProfile(null)
          setLoading(false);
        }
        
        clearTimeout(timeoutId);
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutId);
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      console.log('AuthContext: fetchProfile called for user:', userId);
      
      // Add timeout for profile fetching
      const profileTimeout = setTimeout(() => {
        console.log('AuthContext: Profile fetch timeout, continuing without profile');
        // Don't set loading here - it's handled by the caller
      }, 5000); // 5 second timeout for profile
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      clearTimeout(profileTimeout);

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile:', error)
        return
      }

      if (data) {
        console.log('AuthContext: Profile found:', data);
        setProfile(data)
      } else {
        console.log('AuthContext: No profile found, creating new one...');
        // Create profile if it doesn't exist
        await createProfile(userId)
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error)
    }
  }

  const createProfile = async (userId: string) => {
    let createTimeout: NodeJS.Timeout;
    
    try {
      console.log('AuthContext: createProfile called for user:', userId);
      
      // Add timeout for profile creation
      createTimeout = setTimeout(() => {
        console.log('AuthContext: Profile creation timeout, continuing without profile');
        return;
      }, 5000); // 5 second timeout
      
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        console.log('AuthContext: No user data found, cannot create profile');
        clearTimeout(createTimeout);
        return
      }

      console.log('AuthContext: User data for profile creation:', userData.user);

      const newProfile = {
        id: userId,
        email: userData.user.email || '',
        full_name: userData.user.user_metadata?.full_name || '',
        avatar_url: userData.user.user_metadata?.avatar_url || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('AuthContext: Creating profile with data:', newProfile);

      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single()

      clearTimeout(createTimeout);

      if (error) {
        console.error('Error creating profile:', error)
        return
      }

      console.log('AuthContext: Profile created successfully:', data);
      setProfile(data)
    } catch (error) {
      console.error('Error in createProfile:', error)
      if (createTimeout) clearTimeout(createTimeout);
    }
  }

  // Traditional email/password signup
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    if (error) throw error
  }

  // Traditional email/password signin
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  // Google OAuth signin
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      console.log('🔍 DEBUG AuthContext: Starting sign out process...');
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('🔍 DEBUG AuthContext: Sign out error:', error);
        throw error;
      }
      console.log('🔍 DEBUG AuthContext: Supabase sign out successful');
      
      // Clear local state immediately
      console.log('🔍 DEBUG AuthContext: Clearing local state...');
      setUser(null);
      setSession(null);
      setProfile(null);
      console.log('🔍 DEBUG AuthContext: Local state cleared');
      
      // Force loading to false to trigger redirects
      setLoading(false);
      console.log('🔍 DEBUG AuthContext: Loading set to false');
      
    } catch (error) {
      console.error('🔍 DEBUG AuthContext: Exception in sign out:', error);
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      throw error;
    }
  }

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    setProfile(data)
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      signOut,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
