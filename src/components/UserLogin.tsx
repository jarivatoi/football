import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveLastUsedIdNumber, getLastUsedIdNumber, saveUserSession } from '../utils/userSessionDB';
import { gsap } from 'gsap';
import SplitText from '../utils/SplitText';
import { Eye, EyeOff } from 'lucide-react';
import UserRegistration from './UserRegistration';

// Animated Registration Button Component with SplitText
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
        padding: '12px 14px',
        borderRadius: 8,
        border: 'none',
        background: '#10b981',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
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

type UserLoginProps = {
  onLoginSuccess: (session: { userId: string; idNumber: string; isAdmin: boolean; surname?: string; name?: string }) => void
}

const UserLogin: React.FC<UserLoginProps> = ({ onLoginSuccess }) => {
  const headerRef = useRef<HTMLHeadingElement>(null);

  const [idNumber, setIdNumber] = useState('');
  
  useEffect(() => {
    const loadLastId = async () => {
      try {
        const lastId = await getLastUsedIdNumber();
        if (lastId) {
          setIdNumber(lastId);
        }
      } catch (error) {
        console.warn('Could not load last used ID number:', error);
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
  const [showRegistration, setShowRegistration] = useState(false)

  // GSAP SplitText wave zoom animation for "User Sign In" header
  useEffect(() => {
    if (headerRef.current && !showRegistration) {
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
  }, [showForgotPasscode, showRegistration]);

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
    
    if (!idNumber || !passcode) {
      setError('Enter a Valid ID Number and Passcode')
      return
    }
    
    // Admin 5274 login
    if (passcode === '5274' && idNumber === '5274') {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, id_number, surname, name, is_admin')
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
          name: userData.name
        };
        
        await saveUserSession(session);
        await saveLastUsedIdNumber('5274');
        
        onLoginSuccess(session);
        return;
      } catch (error) {
        console.error('❌ Admin 5274 login failed:', error);
        setError('Failed to login as admin. Please try again.');
        return;
      }
    }
    
    // Regular user login flow
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, surname, name, id_number, passcode, is_admin, is_active')
        .eq('id_number', idNumber)
        .single()
      
      if (error || !data) throw new Error('User not found')
      const row = data
      
      if (!row.is_active) throw new Error('Access Denied')
      
      // PLAIN TEXT comparison
      if (passcode !== row.passcode) throw new Error('Incorrect passcode')
      
      // Update last login
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', row.id)
      
      // Store the ID number for future logins
      await saveLastUsedIdNumber(row.id_number);
      
      const session = { 
        userId: row.id, 
        idNumber: row.id_number, 
        isAdmin: !!row.is_admin,
        surname: row.surname || '',
        name: row.name || ''
      };
      
      await saveUserSession(session);
      
      onLoginSuccess(session)
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
      setError('ID Number must be exactly 14 alphanumeric characters')
      return
    }
    
    try {
      const { data, error } = await supabase.from('users').select('id').eq('id_number', tempIdNumber).single()
      
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
      // Check if passcode is already in use by another user
      const { data: existingPasscodeUser } = await supabase
        .from('users')
        .select('id, surname, name')
        .eq('passcode', newPasscode)
        .single();
          
      if (existingPasscodeUser) {
        const { data: currentUser } = await supabase
          .from('users')
          .select('id')
          .eq('id_number', tempIdNumber)
          .single();
        
        if (!currentUser || existingPasscodeUser.id !== currentUser.id) {
          setError('This Passcode is already used by another user. Choose a different 4-digit code.');
          return;
        }
      }
      
      // Update with PLAIN TEXT passcode
      const { error } = await supabase.from('users').update({ passcode: newPasscode }).eq('id_number', tempIdNumber)
      
      if (error) throw error
      
      // Auto-login with new passcode
      const { data: updatedUser } = await supabase
        .from('users')
        .select('id, surname, name, id_number, is_admin')
        .eq('id_number', tempIdNumber)
        .single();
      
      if (updatedUser) {
        const session = { 
          userId: updatedUser.id, 
          idNumber: updatedUser.id_number, 
          isAdmin: !!updatedUser.is_admin,
          surname: updatedUser.surname,
          name: updatedUser.name
        };
        
        await saveUserSession(session);
        await saveLastUsedIdNumber(updatedUser.id_number);
        
        onLoginSuccess(session);
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
            {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            <button onClick={handleForgotPasscode} style={buttonStyle}>Verify ID</button>
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Back</button>
          </div>
        </div>
      )
    } else {
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
            <button type="button" onClick={() => {
              setShowForgotPasscode(false); 
              setNewPasscode(''); 
              setConfirmPasscode(''); 
              setTempIdNumber(''); 
              setIdVerified(false); 
              setError(null); 
              setPasscode('');
            }} style={{ ...buttonStyle, background: '#6b7280' }}>Cancel</button>
          </div>
        </div>
      )
    }
  }

  // Show registration form
  if (showRegistration) {
    return <UserRegistration onBack={() => setShowRegistration(false)} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      {/* Hide browser's built-in password reveal button */}
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear,
        input[type="password"]::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-show-password-button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        
        @keyframes roll {
          0% {
            transform: translateX(-40px) translateY(-50%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(320px) translateY(-50%) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes distort {
          0%, 100% {
            transform: scaleY(1) scaleX(1);
          }
          50% {
            transform: scaleY(1.3) scaleX(0.8);
          }
        }
        
        .rolling-ball {
          position: absolute;
          top: 50%;
          left: 0;
          animation: roll 2.5s linear infinite;
          font-size: 48px;
          line-height: 1;
          z-index: 0;
        }
        
        .football-letter {
          display: inline-block;
          animation: distort 2s ease-in-out infinite;
        }
        
        .football-letter:nth-child(1) { animation-delay: 0.0s; }
        .football-letter:nth-child(2) { animation-delay: 0.15s; }
        .football-letter:nth-child(3) { animation-delay: 0.3s; }
        .football-letter:nth-child(4) { animation-delay: 0.45s; }
        .football-letter:nth-child(5) { animation-delay: 0.6s; }
        .football-letter:nth-child(6) { animation-delay: 0.75s; }
        .football-letter:nth-child(7) { animation-delay: 0.9s; }
        .football-letter:nth-child(8) { animation-delay: 1.05s; }
      `}</style>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: '12px' }}>
        {/* FOOTBALL Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px', position: 'relative', padding: '10px 0', minHeight: '68px' }}>
          <h1 
            style={{ 
              margin: '0',
              fontSize: '48px',
              fontWeight: '900',
              color: '#2563eb',
              letterSpacing: '4px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
              lineHeight: '1',
              position: 'relative',
              zIndex: 1
            }}
          >
            <span className="football-letter">F</span>
            <span className="football-letter">O</span>
            <span className="football-letter">O</span>
            <span className="football-letter">T</span>
            <span className="football-letter">B</span>
            <span className="football-letter">A</span>
            <span className="football-letter">L</span>
            <span className="football-letter">L</span>
            <span className="rolling-ball">⚽</span>
          </h1>
        </div>
        
        {/* User Sign In - drops from FOOTBALL */}
        <h2 
          ref={headerRef}
          style={{ 
            textAlign: 'center',
            fontSize: '28px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            color: '#6366f1',
            display: 'inline-block'
          }}
        >
          User Sign In
        </h2>
        <input 
          placeholder="ID Number" 
          value={idNumber === '5274' ? '••••' : idNumber}
          onChange={e => {
            const value = e.target.value.toUpperCase();
            setIdNumber(value);
          }} 
          style={inputStyle} 
          autoCapitalize="characters"
          maxLength={14}
          autoComplete="username"
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            placeholder="4-digit Passcode" 
            value={passcode} 
            onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} 
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
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <button type="submit" style={buttonStyle}>Login</button>
      </form>
      <div style={{ display: 'grid', gap: '8px', width: '100%', maxWidth: 420, marginTop: '16px' }}>
        <AnimatedRegistrationButton onClick={() => setShowRegistration(true)} />
        <button type="button" onClick={() => {
          setError(null);
          setShowForgotPasscode(true);
        }} style={{ ...buttonStyle, background: '#ef4444' }}>Forgot Passcode</button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, textAlign: 'center'
}
const buttonStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer'
}

export default UserLogin
