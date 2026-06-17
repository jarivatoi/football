import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

type UserRegistrationProps = {
  onBack: () => void
}

const UserRegistration: React.FC<UserRegistrationProps> = ({ onBack }) => {
  const [surname, setSurname] = useState('')
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [confirmIdNumber, setConfirmIdNumber] = useState('')
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false)
  const [submittedData, setSubmittedData] = useState<{idNumber: string; surname: string; name: string} | null>(null)

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Helper function to capitalize surname (ALL CAPS, allows hyphens)
  const capitalizeSurname = (str: string): string => {
    return str.toUpperCase().replace(/[^A-Z-]/g, '')
  }

  // Helper function to capitalize name (first letter of each word)
  const capitalizeName = (str: string): string => {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    
    // Check if user is online
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      setIsLoading(false)
      return
    }
    
    // Check if ID numbers match
    if (idNumber !== confirmIdNumber) {
      setError('ID number does not match. Please re-enter ID number.')
      setIsLoading(false)
      return
    }
    
    // Basic validation
    const validSurname = surname.trim().length > 0
    const validName = name.trim().length > 0
    const validId = /^[A-Z0-9]{14}$/.test(idNumber) // Exactly 14 alphanumeric characters
    const validPass = /^\d{4}$/.test(passcode)
    
    if (!validSurname || !validName || !validId || !validPass) {
      setError('Please fill all fields: surname, name, ID (exactly 14 letters+digits), and a 4-digit passcode')
      setIsLoading(false)
      return
    }
    
    try {
      // Check if ID number already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, id_number')
        .eq('id_number', idNumber)
        .single()
      
      if (existingUser) {
        setError('User already exists with this ID number')
        setIsLoading(false)
        return
      }
      
      // All validations passed, insert new user
      // is_active = false by default - requires admin approval
      const { data, error } = await supabase.from('users').insert([{ 
        surname: surname.trim(), 
        name: name.trim(), 
        id_number: idNumber, 
        passcode: passcode,
        is_admin: false, 
        is_active: false // Awaiting admin approval
      }])
      
      if (error) {
        setError(error.message ?? 'Registration failed')
        return
      }
      
      // Registration successful - show awaiting confirmation screen
      setRegistrationSubmitted(true)
      setSubmittedData({
        idNumber,
        surname: surname.trim(),
        name: name.trim()
      })
      
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = { 
    padding: '12px 14px', 
    border: '1px solid #d1d5db', 
    borderRadius: 8, 
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box'
  }
  
  const btn: React.CSSProperties = { 
    padding: '12px 14px', 
    borderRadius: 8, 
    border: 'none', 
    background: '#2563eb', 
    color: 'white', 
    fontWeight: 600, 
    cursor: 'pointer', 
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box'
  }
  
  // Show awaiting confirmation screen after registration
  if (registrationSubmitted && submittedData) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: 500, textAlign: 'center', width: '100%', padding: '20px' }}>
          <div style={{ fontSize: 64, marginBottom: 20, animation: 'pulse 2s ease-in-out infinite' }}>
            ⏳
          </div>
          <h2 style={{ color: '#2563eb', marginBottom: 10, fontSize: 24 }}>
            Registration Awaiting Confirmation
          </h2>
          
          <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 12, margin: '20px 0', border: '2px solid #bae6fd' }}>
            <p style={{ fontSize: 16, marginBottom: 15, color: '#0369a1' }}>
              Your registration has been submitted successfully!
            </p>
            
            <div style={{ textAlign: 'left', margin: '15px 0' }}>
              <p style={{ margin: '8px 0', fontSize: 14 }}>
                <strong>Name:</strong> {submittedData.surname} {submittedData.name}
              </p>
              <p style={{ margin: '8px 0', fontSize: 14 }}>
                <strong>ID Number:</strong> {submittedData.idNumber}
              </p>
            </div>
            
            <div style={{ background: '#fef3c7', padding: 15, borderRadius: 8, marginTop: 15, border: '1px solid #fcd34d' }}>
              <p style={{ fontSize: 14, color: '#92400e', margin: 0 }}>
                <strong>⚠️ Action Required:</strong><br/>
                Your registration is awaiting administrator approval.<br/><br/>
                <strong>Please contact the administrator</strong> to approve your registration.
              </p>
            </div>
          </div>
          
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 20 }}>
            Once approved, you can login using your ID Number and Passcode.
          </p>
          
          <button 
            onClick={onBack} 
            style={{ ...btn, background: '#6b7280', marginTop: 20 }}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, width: '100%', maxWidth: 420, padding: '20px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, marginBottom: 8 }}>
          User Registration
        </h2>
        <input 
          placeholder="Surname" 
          value={surname} 
          onChange={e => setSurname(capitalizeSurname(e.target.value))} 
          style={inputStyle} 
        />
        <input 
          placeholder="Name" 
          value={name} 
          onChange={e => setName(capitalizeName(e.target.value))} 
          style={inputStyle} 
        />
        <input 
          placeholder="ID Number" 
          value={idNumber} 
          onChange={e => setIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
          style={inputStyle} 
          autoCapitalize="characters" 
        />
        <input 
          placeholder="Re-enter ID Number (verification)" 
          value={confirmIdNumber} 
          onChange={e => setConfirmIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
          style={inputStyle} 
          autoCapitalize="characters" 
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            placeholder="Enter a 4-digit Passcode" 
            value={passcode} 
            onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
            style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
            type={showPasscode ? 'text' : 'password'}
            inputMode="numeric" 
            maxLength={4}
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
        <button 
          type="submit" 
          style={{ ...btn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }} 
          disabled={isLoading}
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
        <button type="button" onClick={onBack} style={{ ...btn, background: '#6b7280' }}>
          Back to Login
        </button>
      </form>
    </div>
  )
}

export default UserRegistration
