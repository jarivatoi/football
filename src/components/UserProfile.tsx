import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminPanel from './AdminPanel'
import ConfirmationModal from './ConfirmationModal'
import { removeUserSession } from '../utils/userSessionDB'
import { Eye, EyeOff } from 'lucide-react'

type ProfileProps = {
  user: { id: string; idNumber: string; surname: string; name: string; isAdmin: boolean } | null
  onLoginSuccess: (session: { userId: string; idNumber: string; isAdmin: boolean }) => void
  onClose?: () => void
}

const ProfileTab: React.FC<ProfileProps> = ({ user, onLoginSuccess, onClose }) => {
  const [surname, setSurname] = useState('')
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [forgotPasscode, setForgotPasscode] = useState(false)
  const [tempIdNumber, setTempIdNumber] = useState('')
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [showNewPasscode, setShowNewPasscode] = useState(false)
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showBackButton, setShowBackButton] = useState(false)

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Profile: User is back online');
    };

    const handleOffline = () => {
      console.log('📡 Profile: User went offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      if (!user?.id) return
      const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!error && data) {
        setSurname(data.surname || '')
        setName(data.name || '')
        setIdNumber(data.id_number || '')
      }
    }
    fetchMe()
  }, [user?.id])

  // Helper function to capitalize surname (ALL CAPS, allows hyphens)
  const capitalizeSurname = (str: string): string => {
    return str.toUpperCase().replace(/[^A-Z-]/g, '');
  };

  const save = async () => {
    if (!user?.id) return
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    setShowSaveModal(true)
  }

  const handleSaveConfirm = async () => {
    if (!user?.id) {
      setError('User not authenticated')
      setShowSaveModal(false)
      return
    }
    
    try {
      // Only update surname and name, not id_number
      await supabase.from('users').update({ surname, name, updated_at: new Date().toISOString() }).eq('id', user.id)
      setError('Profile saved successfully')
      setShowSaveModal(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      setError('Failed to save profile')
      setShowSaveModal(false)
    }
  }

  const changePasscode = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    setForgotPasscode(true)
    setTempIdNumber(idNumber) // Pre-fill with current ID
    setPasscode('') // Clear the passcode field when changing passcode
    setError(null) // Clear any previous errors
  }

  const deleteProfile = async () => {
    if (!user?.id) return
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!user?.id) {
      setError('User not authenticated')
      setShowDeleteModal(false)
      return
    }
    
    try {
      await supabase.from('users').delete().eq('id', user.id)
      localStorage.removeItem('staff_session')
      localStorage.removeItem('staff_onboarded')
      localStorage.removeItem('staff_first_run_complete')
      localStorage.removeItem('staff_needs_login')
      localStorage.removeItem('last_used_id_number')
      window.location.reload()
    } catch (error) {
      console.error('Error deleting profile:', error)
      setError('Failed to delete profile')
      setShowDeleteModal(false)
    }
  }

  const hash = async (input: string) => {
    const enc = new TextEncoder()
    const data = enc.encode(input)
    const d = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate that idNumber exists
    if (!idNumber) {
      setError('No ID number found. Please go back and verify your profile.');
      return;
    }
    
    try {
      // For profile login, check if user exists and bypass global login setting
      const rec = await supabase.from('users').select('id, surname, name, id_number, passcode, is_admin, is_active').eq('id_number', idNumber).single()
      if (rec.error || !rec.data) throw new Error('User not found')
      const row = rec.data
      if (!row.is_active) throw new Error('Access Denied')
      const hashed = passcode
      if (hashed !== row.passcode) throw new Error('Incorrect passcode')
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', row.id)
      onLoginSuccess({ userId: row.id, idNumber: row.id_number, isAdmin: !!row.is_admin })
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
    }
  }

  const handleForgotPasscode = async () => {
    setError(null)
    try {
      const { data, error } = await supabase.from('users').select('id').eq('id_number', tempIdNumber).single()
      if (error || !data) {
        setError('Incorrect ID Number, Contact Developer')
        return
      }
      
      // ID verified, now allow setting new passcode
      setForgotPasscode(true)
    } catch (err) {
      setError('Incorrect ID Number, Contact Developer')
    }
  }

  const handleUpdatePasscode = async () => {
    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match')
      return
    }
    
    if (newPasscode.length !== 4 || !/^\d{4}$/.test(newPasscode)) {
      setError('Passcode must be 4 digits')
      return
    }
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    try {
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }
      const updateResult = await supabase.from('users').update({ passcode: newPasscode }).eq('id', user.id);
      
      if (updateResult.error) {
        console.error('Profile update error:', updateResult.error);
        throw updateResult.error;
      }
      
      // Verify the update actually happened
      const verify = await supabase.from('users').select('passcode').eq('id', user.id).single();
      console.log('Profile verification after update:', { 
        expected: newPasscode, 
        actual: verify.data?.passcode, 
        match: newPasscode === verify.data?.passcode,
        userId: user.id
      });
      
      // Also check if we can read the record directly
      const directCheck = await supabase.from('users').select('id, passcode').eq('id', user.id).single();
      console.log('Direct record check:', directCheck);
      
      setError('Passcode updated successfully')
      setForgotPasscode(false)
      setNewPasscode('')
      setConfirmPasscode('')
      setTempIdNumber('')
      setPasscode('') // Clear the main passcode field
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update passcode')
    }
  }

  if (!user) return <div style={{ padding: 16 }}>Sign in to view profile</div>

  const isAdmin = !!user.isAdmin

  if (showLogin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
          <h2 style={{ textAlign: 'center' }}>Enter Passcode</h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              placeholder="4-digit Passcode" 
              value={passcode} 
              onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
              style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
              type={showPasscode ? 'text' : 'password'}
              inputMode="numeric" 
              maxLength={4}
              autoFocus
            />
            <button
              type="button"
              onMouseDown={() => setShowPasscode(true)}
              onMouseUp={() => setShowPasscode(false)}
              onMouseLeave={() => setShowPasscode(false)}
              onTouchStart={() => setShowPasscode(true)}
              onTouchEnd={() => setShowPasscode(false)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#6b7280',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
            >
              {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
          <button type="submit" style={buttonStyle}>Login</button>
          <button type="button" onClick={() => {setShowLogin(false); setForgotPasscode(false);}} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          <button type="button" onClick={() => {setShowLogin(false); setForgotPasscode(true); setTempIdNumber('')}} style={{ ...buttonStyle, background: '#ef4444' }}>Forgot Passcode</button>
        </form>
      </div>
    )
  }

  if (forgotPasscode && !showLogin) {
    if (!tempIdNumber) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Forgot Passcode</h2>
            <input 
              placeholder="Enter ID Number" 
              value={tempIdNumber} 
              onChange={e => setTempIdNumber(e.target.value)} 
              style={inputStyle} 
            />
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleForgotPasscode} style={buttonStyle}>Verify ID</button>
            <button type="button" onClick={() => {setForgotPasscode(false); setTempIdNumber('');}} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          </div>
        </div>
      )
    } else if (forgotPasscode && tempIdNumber && !error) {
      // Only show update passcode screen after successful ID verification
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Update Passcode</h2>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                placeholder="New 4-digit Passcode" 
                value={newPasscode} 
                onChange={e => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
                type={showNewPasscode ? 'text' : 'password'}
                inputMode="numeric" 
                maxLength={4}
              />
              <button
                type="button"
                onMouseDown={() => setShowNewPasscode(true)}
                onMouseUp={() => setShowNewPasscode(false)}
                onMouseLeave={() => setShowNewPasscode(false)}
                onTouchStart={() => setShowNewPasscode(true)}
                onTouchEnd={() => setShowNewPasscode(false)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  color: '#6b7280',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
              >
                {showNewPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                placeholder="Re-enter Passcode" 
                value={confirmPasscode} 
                onChange={e => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
                type={showConfirmPasscode ? 'text' : 'password'}
                inputMode="numeric" 
                maxLength={4}
              />
              <button
                type="button"
                onMouseDown={() => setShowConfirmPasscode(true)}
                onMouseUp={() => setShowConfirmPasscode(false)}
                onMouseLeave={() => setShowConfirmPasscode(false)}
                onTouchStart={() => setShowConfirmPasscode(true)}
                onTouchEnd={() => setShowConfirmPasscode(false)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  color: '#6b7280',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
              >
                {showConfirmPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>

            </div>

            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleUpdatePasscode} style={buttonStyle}>Update Passcode</button>
            <button type="button" onClick={() => {setForgotPasscode(false); setNewPasscode(''); setConfirmPasscode(''); setTempIdNumber('');}} style={{ ...buttonStyle, background: '#6b7280' }}>Cancel</button>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ 
      padding: isAdmin ? 0 : 16,
      height: '100%',
      boxSizing: 'border-box',
      backgroundColor: isAdmin ? 'transparent' : '#ffffff'
    }}>
      {/* Back Button */}
      {onClose && !isAdmin && (
        <button
          onClick={onClose}
          style={{
            marginBottom: 16,
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          ← Back to App
        </button>
      )}
      
      {isAdmin ? (
        // Admin users see Admin Panel with Back and Logout buttons
        <>
          <AdminPanel 
            onBack={onClose}
            onLogout={async () => {
              console.log('🚪 Admin logging out...');
              await removeUserSession();
              // Clear the session in parent App component
              onLoginSuccess({ userId: '', idNumber: '', isAdmin: false });
              // Close UserProfile to return to App, which will show login
              if (onClose) {
                console.log('✅ Closing UserProfile, App will show login page');
                onClose();
              }
            }}
          />
        </>
      ) : (
        // Regular users see profile form
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h3 style={{ marginBottom: 12, textAlign: 'center' }}>Profile</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <input value={surname} onChange={e => setSurname(capitalizeSurname(e.target.value))} placeholder="Surname" style={inputStyle} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={inputStyle} />
            <input value={idNumber} readOnly placeholder="ID Number" style={{ ...inputStyle, backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
            <button onClick={save} style={buttonStyle}>Save Profile</button>
            <button onClick={changePasscode} style={{ ...buttonStyle, background: '#f59e0b', marginTop: 12 }}>Change Passcode</button>
            <button onClick={deleteProfile} style={{ ...buttonStyle, background: '#ef4444', marginTop: 12 }}>Delete Profile</button>
            <button 
              onClick={async () => { 
                // Clear IndexedDB session (but keep last_used_id_number for auto-fill convenience)
                await removeUserSession();
                // Also clear localStorage session data for compatibility
                localStorage.removeItem('staff_session');
                localStorage.removeItem('staff_onboarded');
                localStorage.removeItem('staff_first_run_complete');
                localStorage.removeItem('staff_needs_login');
                // DON'T clear last_used_id_number - keeps auto-fill for convenience
                window.location.reload();
              }} 
              style={{ ...buttonStyle, background: '#6b7280', marginTop: 12 }}
            >
              Logout
            </button>
          
          </div>
          {error && <div style={{ color: 'red', marginTop: 12, textAlign: 'center' }}>{error}</div>}
          
          {/* Save Confirmation Modal */}
          <ConfirmationModal
            isOpen={showSaveModal}
            title="Save Profile"
            message="Are you sure you want to save your profile changes?"
            onConfirm={handleSaveConfirm}
            onCancel={() => setShowSaveModal(false)}
            confirmText="Save"
          />
          
          {/* Delete Confirmation Modal */}
          <ConfirmationModal
            isOpen={showDeleteModal}
            title="Delete Profile"
            message="This will permanently delete your account and all associated data. This action cannot be undone. Are you sure you want to continue?"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteModal(false)}
            confirmText="Delete Profile"
            isDanger={true}
          />
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textAlign: 'center'
}
const buttonStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none'
}

export default ProfileTab
