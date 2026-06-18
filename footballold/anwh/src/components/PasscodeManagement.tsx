import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { updatePasscode, isPasscodeTaken } from '../utils/passcodeAuth';

interface PasscodeManagementProps {
  userId: string;
  currentPasscode?: string;
}

export const PasscodeManagement: React.FC<PasscodeManagementProps> = ({ 
  userId, 
  currentPasscode 
}) => {
  const [isChanging, setIsChanging] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!newPasscode.trim()) {
      setError('Please enter a passcode');
      return;
    }

    if (newPasscode.length < 4) {
      setError('Passcode must be at least 4 characters');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Check if passcode is already taken
      const taken = await isPasscodeTaken(newPasscode, userId);
      if (taken) {
        setError('This passcode is already in use. Please choose another.');
        setIsLoading(false);
        return;
      }

      // Update passcode
      const result = await updatePasscode(userId, newPasscode);
      
      if (result.success) {
        setSuccess('✅ Passcode updated successfully!');
        setNewPasscode('');
        setConfirmPasscode('');
        setTimeout(() => {
          setSuccess('');
          setIsChanging(false);
        }, 3000);
      } else {
        setError(result.error || 'Failed to update passcode');
      }
    } catch (err) {
      console.error('Error updating passcode:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isChanging) {
    return (
      <div style={{
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px',
        marginTop: '16px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1f2937' }}>
          🔐 Your Passcode
        </h3>
        {currentPasscode ? (
          <p style={{ margin: '0 0 12px 0', color: '#6b7280' }}>
            You have a passcode set. Use it to authenticate roster changes.
          </p>
        ) : (
          <p style={{ margin: '0 0 12px 0', color: '#ef4444' }}>
            ⚠️ You don't have a passcode yet. Please set one to edit the roster.
          </p>
        )}
        <button
          onClick={() => {
            setIsChanging(true);
            setError('');
            setSuccess('');
          }}
          style={{
            padding: '8px 16px',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {currentPasscode ? 'Change Passcode' : 'Set Passcode'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: '#f9fafb',
      borderRadius: '8px',
      marginTop: '16px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1f2937' }}>
        {currentPasscode ? '🔄 Change Passcode' : '🔑 Set Your Passcode'}
      </h3>
      
      <form onSubmit={handleUpdatePasscode}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, color: '#374151' }}>
            New Passcode
          </label>
          <input
            type="text"
            value={newPasscode}
            onChange={(e) => setNewPasscode(e.target.value)}
            placeholder="Enter unique passcode (min 4 characters)"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, color: '#374151' }}>
            Confirm Passcode
          </label>
          <input
            type="text"
            value={confirmPasscode}
            onChange={(e) => setConfirmPasscode(e.target.value)}
            placeholder="Re-enter passcode"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '8px',
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '8px',
            background: '#dcfce7',
            color: '#16a34a',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: isLoading ? '#9ca3af' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Updating...' : 'Save Passcode'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setIsChanging(false);
              setError('');
              setSuccess('');
              setNewPasscode('');
              setConfirmPasscode('');
            }}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
