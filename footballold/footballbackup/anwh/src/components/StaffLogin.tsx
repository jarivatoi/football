import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveLastUsedIdNumber, getLastUsedIdNumber, saveUserSession, checkActiveSession, clearUserSessionByUserId } from '../utils/indexedDB';
import { gsap } from 'gsap';
import SplitText from '../utils/SplitText';
import { Eye, EyeOff } from 'lucide-react';

// Animated Registration Button Component
const AnimatedRegistrationButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (text1Ref.current && text2Ref.current) {
      SplitText.register(gsap);

      // Create SplitText instances for both texts
      const split1 = new SplitText(text1Ref.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });

      const split2 = new SplitText(text2Ref.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });

      // Set initial states - both texts start hidden off to the right
      gsap.set(split1.chars, {
        opacity: 0,
        x: 50,
        y: 0,
        scale: 1,
        display: 'inline-block'
      });

      gsap.set(split2.chars, {
        opacity: 0,
        x: 50,
        y: 0,
        scale: 1,
        display: 'inline-block'
      });

      // Ensure only Registration is visible initially
      gsap.set(split1.chars, {
        opacity: 1,
        x: 0,
        display: 'inline-block'
      });

      // Create timeline for seamless loop
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.5
      });

      // Animate "Registration" in
      tl.to(split1.chars, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      });

      // Hold
      tl.to({}, { duration: 0.5 });

      // Animate "Registration" out
      tl.to(split1.chars, {
        opacity: 0,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.in'
      });

      // Animate "First Time Users Only" in
      tl.to(split2.chars, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      }, '-=0.4');

      // Hold
      tl.to({}, { duration: 0.5 });

      // Animate "First Time Users Only" out
      tl.to(split2.chars, {
        opacity: 0,
        duration: 0.7,
        stagger: 0.03,
        ease: 'power2.in'
      });

      // Reset Registration position
      tl.set(split1.chars, {
        x: 50,
        opacity: 0
      }, '-=0.4');

      // Loop back
      tl.to(split1.chars, {
        opacity: 1,
        x: 0,
        duration: 0.5,
        stagger: 0.03,
        ease: 'power2.out'
      }, '-=0.4');

      return () => {
        split1.revert();
        split2.revert();
        tl.kill();
      };
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      style={{
        ...buttonStyle,
        background: '#10b981',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span ref={text1Ref} style={{ display: 'block', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Registration</span>
      <span ref={text2Ref} style={{ display: 'block', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>First Time Users Only</span>
    </button>
  );
}

type StaffLoginProps = {
  onLoginSuccess: (session: { userId: string; idNumber: string; isAdmin: boolean; surname?: string; name?: string; institution_code?: string }) => void
  onRegister?: () => void
  showIdField?: boolean
}

const StaffLogin: React.FC<StaffLoginProps> = ({ onLoginSuccess, onRegister, showIdField = true }) => {
  const headerRef = useRef<HTMLHeadingElement>(null);

  // Try to get the last used ID number from IndexedDB to pre-fill
  const [idNumber, setIdNumber] = useState('');
  
  useEffect(() => {
    const loadLastId = async () => {
      try {
        const lastId = await getLastUsedIdNumber();
        if (lastId) {
          setIdNumber(lastId);
        }
      } catch (error) {
        console.warn('Could not load last used ID number from IndexedDB:', error);
        const fallbackId = localStorage.getItem('last_used_id_number');
        if (fallbackId) {
          setIdNumber(fallbackId);
        }
      }
    };
    
    loadLastId();
  }, []);

  const [passcode, setPasscode] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPasscode, setShowForgotPasscode] = useState(false)
  const [tempIdNumber, setTempIdNumber] = useState('')
  const [idVerified, setIdVerified] = useState(false)
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [showNewPasscode, setShowNewPasscode] = useState(false)
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false)

  // GSAP SplitText wave zoom animation for "Staff Sign In" header
  useEffect(() => {
    if (headerRef.current) {
      SplitText.register(gsap);
      
      const split = new SplitText(headerRef.current, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });
      
      gsap.set(split.chars, {
        opacity: 0,
        scale: 0.5,
        y: -100,
        rotationX: -90,
        transformOrigin: 'center center -50',
        display: 'inline-block'
      });
      
      split.chars.forEach(char => {
        char.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
        char.style.backgroundClip = 'text';
        char.style.webkitBackgroundClip = 'text';
        char.style.webkitTextFillColor = 'transparent';
      });
      
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1.5
      });
      
      tl.to(split.chars, {
        opacity: 1,
        scale: 1,
        y: 0,
        rotationX: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'back.out(1.7)',
        transformOrigin: 'center center'
      });
      
      tl.to({}, { duration: 1.5 });
      
      tl.to(split.chars, {
        opacity: 0,
        scale: 0.5,
        y: 50,
        rotationX: -90,
        duration: 0.4,
        stagger: {
          amount: 0.3,
          from: 'end'
        },
        ease: 'back.in(1.7)',
        transformOrigin: 'center center'
      });
      
      tl.set(split.chars, {
        y: -100,
        rotationX: -90,
        scale: 0.5
      });

      return () => {
        split.revert();
      };
    }
  }, [showForgotPasscode]);

  // Check if user is online
  const checkOnlineStatus = (): boolean => {
    return navigator.onLine
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    setError(null)
    
    const actualIdNumber = showIdField ? idNumber : (passcode === '5274' ? '5274' : idNumber)
    
    if (!actualIdNumber || !passcode) {
      setError('Enter a Valid ID Number and Passcode')
      return
    }
    
    // Validate ID format
    if (actualIdNumber !== '5274' && actualIdNumber.length < 14) {
      setError('Please enter the full ID Number')
      return
    }
    
    
    if (passcode === '5274' && actualIdNumber === '5274') {
      // Admin 5274 login - fetch actual user data from database
      try {
        const { data: userData, error } = await supabase
          .from('staff_users')
          .select('id, id_number, surname, name, institution_code, posting_institution, is_admin')
          .eq('id_number', '5274')
          .single();
        
        if (error || !userData) {
          setError('Admin account not found in database');
          return;
        }
        
        const session = { 
          userId: userData.id,
          idNumber: '5274', 
          isAdmin: userData.is_admin || true, 
          surname: userData.surname, 
          name: userData.name,
          institution_code: userData.institution_code,
          posting_institution: userData.posting_institution
        };
        onLoginSuccess(session);
        return;
      } catch (error) {
        console.error('❌ Admin 5274 login failed:', error);
        setError('Failed to login as admin. Please try again.');
        return;
      }
    }
    
    // Regular staff login flow - using PLAIN TEXT passcode comparison
    try {
      const { data, error } = await supabase
        .from('staff_users')
        .select('id, surname, name, id_number, passcode, is_admin, is_active, registration_approved, institution_code')
        .eq('id_number', actualIdNumber)
        .single()
      
      if (error || !data) throw new Error('User not found')
      const row = data
      
      if (!row.is_active) throw new Error('Access Denied')
      
      // Check if registration has been approved by admin
      if (!row.registration_approved) {
        setError('Your registration is awaiting approval. Please contact your Admin.');
        return;
      }
      
      // PLAIN TEXT comparison (not hashed - per user request)
      if (passcode !== row.passcode) throw new Error('Incorrect passcode')
      
      // Update last login
      await supabase.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', row.id)
      
      // Store the ID number for future logins
      try {
        await saveLastUsedIdNumber(row.id_number);
      } catch (error) {
        console.warn('Could not save ID number:', error);
      }
      
      onLoginSuccess({ 
        userId: row.id, 
        idNumber: row.id_number, 
        isAdmin: !!row.is_admin,
        surname: row.surname || '',
        name: row.name || '',
        institution_code: row.institution_code || ''
      })
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
    }
  }

  const handleForgotPasscode = async () => {
    setError(null)
    setPasscode('')
    
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    if (!tempIdNumber || tempIdNumber.trim().length === 0) {
      setError('Enter a valid ID')
      return
    }
    
    if (!/^[A-Z0-9]{14}$/.test(tempIdNumber)) {
      setError('Enter a valid ID')
      return
    }
    
    try {
      const { data, error } = await supabase.from('staff_users').select('id').eq('id_number', tempIdNumber).single()
      
      if (error || !data) {
        setError('Incorrect ID Number')
        return
      }
      
      setIdVerified(true)
      setError(null)
    } catch (err) {
      setError('Incorrect ID Number')
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
    
    if (!checkOnlineStatus()) {
      setError('You are currently offline, please check your connectivity and try again...')
      return
    }
    
    try {
      // First, check if passcode is already in use by another user
      const { data: existingPasscodeUser } = await supabase
        .from('staff_users')
        .select('id, surname, name')
        .eq('passcode', newPasscode)
        .single();
          
      if (existingPasscodeUser) {
        // Check if it's the same user (allow keeping their own passcode)
        const { data: currentUser } = await supabase
          .from('staff_users')
          .select('id')
          .eq('id_number', tempIdNumber)
          .single();
        
        if (!currentUser || existingPasscodeUser.id !== currentUser.id) {
          setError('This Passcode is already used by another staff member. Choose a different 4-digit code.');
          return;
        }
      }
      
      // Update with PLAIN TEXT passcode (not hashed)
      const { error } = await supabase.from('staff_users').update({ passcode: newPasscode }).eq('id_number', tempIdNumber)
      
      if (error) throw error
      
      // Auto-login with new passcode
      const { data: updatedUser } = await supabase
        .from('staff_users')
        .select('id, surname, name, id_number, is_admin')
        .eq('id_number', tempIdNumber)
        .single();
      
      if (updatedUser) {
        // Save session to IndexedDB
        await saveUserSession({ 
          userId: updatedUser.id, 
          idNumber: updatedUser.id_number, 
          isAdmin: !!updatedUser.is_admin,
          surname: updatedUser.surname,
          name: updatedUser.name
        });
        
        // Store ID for auto-fill
        await saveLastUsedIdNumber(updatedUser.id_number);
        
        console.log('✅ [AUTH] Passcode updated, auto-logging in...', updatedUser);
        
        // Call onLoginSuccess to load the app directly
        onLoginSuccess({ 
          userId: updatedUser.id, 
          idNumber: updatedUser.id_number, 
          isAdmin: !!updatedUser.is_admin,
          surname: updatedUser.surname || '',
          name: updatedUser.name || ''
        });
      }
    } catch (err: any) {
      console.error('Failed to update passcode:', err);
      setError(err?.message ?? 'Failed to update passcode')
    }
  }

  if (showForgotPasscode) {
    if (!idVerified) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
            <h2 style={{ textAlign: 'center' }}>Forgot Passcode</h2>
            <input 
              placeholder="Enter ID Number" 
              value={tempIdNumber} 
              onChange={e => {
                const value = e.target.value.toUpperCase();
                setTempIdNumber(value);
                if (/^[A-Z0-9]{14}$/.test(value)) {
                  setError(null);
                }
              }} 
              style={inputStyle} 
              autoCapitalize="characters"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleForgotPasscode();
                }
              }}
            />
            {error && <div style={{ color: 'red', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{error}</div>}
            <button onClick={handleForgotPasscode} style={buttonStyle}>Verify ID</button>
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
              window.scrollTo(0, 0);
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          </div>
        </div>
      )
    } else if (idVerified) {
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
                  fontSize: '18px',
                  color: '#6b7280'
                }}
              >
                {showNewPasscode ? '🙈' : '👁️'}
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
                  color: '#6b7280'
                }}
              >
                {showConfirmPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && <div style={{ color: 'red', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{error}</div>}
            <button onClick={handleUpdatePasscode} style={buttonStyle}>Update Passcode</button>
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setNewPasscode(''); 
              setConfirmPasscode(''); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
              window.scrollTo(0, 0);
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Cancel</button>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
        <h2 
          ref={headerRef}
          style={{ 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            display: 'inline-block'
          }}
        >
          Staff Sign In
        </h2>
        {showIdField !== false && (
          <input 
            placeholder="ID Number" 
            value={idNumber === '5274' || idNumber === 'admin-5274' ? '••••' : idNumber}
            data-actual-value={idNumber} 
            onChange={e => {
              const value = e.target.value.toUpperCase();
              // Restrict to alphanumeric and max 14 characters
              if (/^[A-Z0-9]*$/.test(value) && value.length <= 14) {
                setIdNumber(value);
              }
            }} 
            style={inputStyle} 
            autoCapitalize="characters"
            maxLength={14}
            autoComplete="username"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            placeholder="4-digit Passcode" 
            value={passcode} 
            onChange={e => setPasscode(e.target.value.replace(/D/g, '').slice(0, 4))} 
            onFocus={() => setError(null)}
            style={{ ...inputStyle, flex: 1, paddingRight: '45px' }} 
            type={showPasscode ? 'text' : 'password'}
            inputMode="numeric" 
            maxLength={4}
            autoComplete="current-password"
            required
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
        {error && <div style={{ color: 'red', textAlign: 'center', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{error}</div>}
        <button type="submit" style={buttonStyle}>Login</button>
      </form>
      <div style={{ display: 'grid', gap: '8px', width: '100%', maxWidth: 420, marginTop: '16px' }}>
        <AnimatedRegistrationButton onClick={() => onRegister && onRegister()} />
        <button type="button" onClick={() => {
          setError(null);
          setShowForgotPasscode(true);
        }} style={{ ...buttonStyle, background: '#ef4444' }}>Forgot Passcode</button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, textAlign: 'center'
}
const buttonStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none'
}

export default StaffLogin