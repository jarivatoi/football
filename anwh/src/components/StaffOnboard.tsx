import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Institution } from '../types'

type OnboardResult = { id?: string; idNumber?: string; surname?: string; name?: string; isAdmin?: boolean; institution_code?: string }

const StaffOnboard: React.FC<{ onComplete?: (u: OnboardResult) => void; onBack?: () => void }> = ({ onComplete, onBack }) => {
  const [surname, setSurname] = useState('')
  const [name, setName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [confirmIdNumber, setConfirmIdNumber] = useState('')
  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInstitution, setSelectedInstitution] = useState('')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false)
  const [submittedData, setSubmittedData] = useState<{idNumber: string; surname: string; name: string; institution: string} | null>(null)

  // Load institutions for dropdown
  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        console.log('🏥 Loading institutions from Supabase...');
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) {
          console.error('❌ Error loading institutions:', error);
          throw error;
        }
        
        console.log('✅ Institutions loaded:', data?.length || 0, data);
        setInstitutions(data || []);
      } catch (err: any) {
        console.error('❌ Failed to load institutions:', err.message);
        setError(`Could not load hospitals list. Please ensure the database is configured correctly.`);
      }
    };
    
    loadInstitutions();
  }, []);

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  // Helper function to capitalize surname (ALL CAPS, allows hyphens)
  const capitalizeSurname = (str: string): string => {
    return str.toUpperCase().replace(/[^A-Z-]/g, '');
  }

  // Helper function to capitalize name (first letter of each word)
  const capitalizeName = (str: string): string => {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
    
    // Validate institution selection
    if (!selectedInstitution) {
      setError('Please select your hospital/institution');
      setIsLoading(false);
      return;
    }
    
    // Basic validation
    const validSurname = surname.trim().length > 0
    const validName = name.trim().length > 0
    const validId = /^[A-Z0-9]{14}$/.test(idNumber) // Exactly 14 alphanumeric characters
    const validPass = /^\d{4}$/.test(passcode)
    if (!validSurname || !validName || !validId || !validPass) {
      setError('Please fill all fields: surname, name, ID (exactly 14 letters+digits), hospital, and a 4-digit passcode')
      setIsLoading(false)
      return
    }
    
    try {
      // Check if ID number already exists
      const { data: existingUser } = await supabase
        .from('staff_users')
        .select('id, id_number')
        .eq('id_number', idNumber)
        .single();
      
      if (existingUser) {
        setError('User already exists with this ID number');
        setIsLoading(false);
        return;
      }
      
      // All validations passed, proceed with insert
      // Passcodes can be duplicated - ID number is the unique identifier
      // registration_approved = false by default - requires admin approval
      const { data, error } = await supabase.from('staff_users').insert([{ 
        surname: surname.trim(), 
        name: name.trim(), 
        id_number: idNumber, 
        passcode: passcode, // Plain text - NOT hashed (can be duplicated)
        institution_code: selectedInstitution,
        is_admin: false, 
        is_active: true, 
        registration_approved: false, // Awaiting admin approval
        last_login: new Date().toISOString() 
      }]);
      
      if (error) {
        console.error('Insert error:', error);
        setError(error.message ?? 'Onboarding failed');
        return;
      }
      
      // Registration successful - show awaiting confirmation screen
      setRegistrationSubmitted(true);
      setSubmittedData({
        idNumber,
        surname: surname.trim(),
        name: name.trim(),
        institution: institutions.find(i => i.code === selectedInstitution)?.name || selectedInstitution
      });
      
    } catch (err: any) {
      console.error('Registration error:', err)
      setError(err?.message ?? 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = { 
    padding: '12px 14px', 
    border: '1px solid #d1d5db', 
    borderRadius: 8, 
    fontSize: Math.min(14, window.innerWidth / 25), // Responsive font size for small phones
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
    userSelect: 'none', 
    WebkitUserSelect: 'none',
    fontSize: Math.min(14, window.innerWidth / 25), // Responsive font size
    width: '100%',
    boxSizing: 'border-box'
  }
  
  // Show awaiting confirmation screen after registration
  if (registrationSubmitted && submittedData) {
    return (
      <div style={{ 
        minHeight: '60vh', 
        display: 'grid', 
        placeItems: 'center', 
        padding: Math.max(10, window.innerWidth / 30)
      }}>
        <div style={{ 
          maxWidth: 500, 
          textAlign: 'center',
          width: '100%',
          padding: Math.min(20, window.innerWidth / 18)
        }}>
          <div style={{ 
            fontSize: Math.min(64, window.innerWidth / 6), 
            marginBottom: 20,
            animation: 'pulse 2s ease-in-out infinite'
          }}>⏳</div>
          <h2 style={{ 
            color: '#2563eb', 
            marginBottom: 10,
            fontSize: Math.min(24, window.innerWidth / 15),
            wordBreak: 'break-word'
          }}>Registration Awaiting Confirmation</h2>
          
          <div style={{ 
            background: '#f0f9ff', 
            padding: Math.min(20, window.innerWidth / 18), 
            borderRadius: 12, 
            margin: '20px 0',
            border: '2px solid #bae6fd'
          }}>
            <p style={{ 
              fontSize: Math.min(16, window.innerWidth / 22), 
              marginBottom: 15, 
              color: '#0369a1' 
            }}>
              Your registration has been submitted successfully!
            </p>
            
            <div style={{ textAlign: 'left', margin: '15px 0' }}>
              <p style={{ 
                margin: '8px 0',
                fontSize: Math.min(14, window.innerWidth / 25),
                wordBreak: 'break-word'
              }}><strong>Name:</strong> {submittedData.surname} {submittedData.name}</p>
              <p style={{ 
                margin: '8px 0',
                fontSize: Math.min(14, window.innerWidth / 25),
                wordBreak: 'break-word'
              }}><strong>ID Number:</strong> {submittedData.idNumber}</p>
              <p style={{ 
                margin: '8px 0',
                fontSize: Math.min(14, window.innerWidth / 25),
                wordBreak: 'break-word'
              }}><strong>Hospital:</strong> {submittedData.institution}</p>
            </div>
            
            <div style={{ 
              background: '#fef3c7', 
              padding: Math.min(15, window.innerWidth / 22), 
              borderRadius: 8, 
              marginTop: 15,
              border: '1px solid #fcd34d'
            }}>
              <p style={{ 
                fontSize: Math.min(14, window.innerWidth / 25), 
                color: '#92400e', 
                margin: 0 
              }}>
                <strong>⚠️ Action Required:</strong><br/>
                Your registration is awaiting administrator approval.<br/><br/>
                <strong>Please contact your Hospital Administrator</strong> to approve your registration.
              </p>
            </div>
          </div>
          
          <p style={{ 
            fontSize: Math.min(14, window.innerWidth / 25), 
            color: '#6b7280', 
            marginTop: 20 
          }}>
            Once approved, you can login using your ID Number and Passcode.
          </p>
          
          <button 
            onClick={() => {
              setRegistrationSubmitted(false);
              onBack?.();
            }} 
            style={{ 
              ...btn, 
              background: '#6b7280', 
              marginTop: 20,
              fontSize: Math.min(14, window.innerWidth / 25)
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: '60vh', 
      display: 'grid', 
      placeItems: 'center',
      padding: Math.max(10, window.innerWidth / 30) // Responsive padding for small phones
    }}>
      <form onSubmit={handleSubmit} style={{ 
        display: 'grid', 
        gap: 12, 
        width: '100%', 
        maxWidth: 420,
        padding: Math.min(20, window.innerWidth / 18) // Responsive padding
      }}>
        <h2 style={{ 
          textAlign: 'center',
          fontSize: Math.min(24, window.innerWidth / 15), // Responsive heading size
          marginBottom: 8,
          wordBreak: 'break-word' // Prevent heading overflow
        }}>Staff Registration</h2>
        <input placeholder="Surname" value={surname} onChange={e => setSurname(capitalizeSurname(e.target.value))} style={inputStyle} />
        <input placeholder="Name" value={name} onChange={e => setName(capitalizeName(e.target.value))} style={inputStyle} />
        <input placeholder="ID Number" value={idNumber} onChange={e => setIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} style={inputStyle} autoCapitalize="characters" maxLength={14} />
        <input placeholder="Re-enter ID Number (verification)" value={confirmIdNumber} onChange={e => setConfirmIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14))} style={inputStyle} autoCapitalize="characters" maxLength={14} />
        
        {/* Hospital/Institution Dropdown */}
        <select 
          value={selectedInstitution} 
          onChange={e => setSelectedInstitution(e.target.value)}
          style={inputStyle}
          disabled={institutions.length === 0}
        >
          <option value="">
            {institutions.length === 0 ? 'Loading...' : 'Select Your Hospital'}
          </option>
          {institutions.map(inst => (
            <option key={inst.code} value={inst.code}>{inst.name}</option>
          ))}
        </select>
        
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
              fontSize: '18px',
              color: '#6b7280',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {showPasscode ? '🙈' : '👁️'}
          </button>
        </div>
        {error && <div style={{ color: 'red', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{error}</div>}
        <button type="submit" style={{ ...btn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }} disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>
        {onBack && (
          <button type="button" onClick={onBack} style={{ ...btn, background: '#6b7280' }}>Back</button>
        )}
      </form>
    </div>
  )
}

export default StaffOnboard
