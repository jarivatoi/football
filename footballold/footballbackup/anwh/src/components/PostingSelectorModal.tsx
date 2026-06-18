import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, CheckCircle, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Institution } from '../types';

interface PostingSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  currentPostingInstitution?: string | null;
  onPostingChanged: (newInstitution: string) => void;
  currentUser?: { id_number?: string } | null; // Add current user prop
}

export const PostingSelectorModal = ({
  isOpen,
  onClose,
  adminUserId,
  currentPostingInstitution,
  onPostingChanged,
  currentUser
}: PostingSelectorModalProps) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load all active institutions
  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setInstitutions(data || []);
      } catch (err: any) {
        console.error('Error loading institutions:', err);
        setError('Failed to load institutions');
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      loadInstitutions();
    }
  }, [isOpen]);

  const handleSelectInstitution = async (institutionCode: string) => {
    try {
      setProcessing(true);
      setError(null);
      setSuccessMessage(null);
      
      // Update user's posting_institution AND institution_code
      const { error } = await supabase
        .from('staff_users')
        .update({ 
          posting_institution: institutionCode,
          institution_code: institutionCode // Also update institution_code to match
        })
        .eq('id', adminUserId);
      
      if (error) throw error;
      
      console.log(`✅ Posting changed to ${institutionCode} - institution_code also updated`);
      setSuccessMessage(`✅ Posting changed successfully!`);
      
      // Notify parent of change
      onPostingChanged(institutionCode);
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err: any) {
      console.error('Error updating posting institution:', err);
      setError(err.message || 'Failed to update posting');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        maxWidth: 600,
        width: '90%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: 20,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={24} className="text-blue-600" />
              Select Posting Institution
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              Choose which hospital's data to view and manage
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            style={{
              background: 'none',
              border: 'none',
              cursor: processing ? 'not-allowed' : 'pointer',
              padding: 8,
              color: '#6b7280',
              opacity: processing ? 0.5 : 1
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: 20,
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Success/Error Messages */}
          {successMessage && (
            <div style={{
              background: '#d1fae5',
              border: '1px solid #6ee7b7',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle size={20} />
              <span style={{ color: '#065f46' }}>{successMessage}</span>
            </div>
          )}
          
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16
            }}>
              <span style={{ color: '#991b1b' }}>❌ {error}</span>
            </div>
          )}

          {/* Current Posting Info */}
          {currentPostingInstitution && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16
            }}>
              <p style={{ fontSize: 14, color: '#1e40af', margin: 0 }}>
                <strong>Current Posting:</strong> {currentPostingInstitution}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Building2 size={48} style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <p>Loading institutions...</p>
            </div>
          )}

          {/* Institution List */}
          {!loading && institutions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {institutions.map(inst => (
                <button
                  key={inst.code}
                  onClick={() => handleSelectInstitution(inst.code)}
                  disabled={processing}
                  style={{
                    padding: 16,
                    background: currentPostingInstitution === inst.code ? '#dbeafe' : 'white',
                    border: `2px solid ${currentPostingInstitution === inst.code ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 8,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    opacity: processing ? 0.7 : 1,
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                  onMouseEnter={(e) => {
                    if (!processing && currentPostingInstitution !== inst.code) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!processing && currentPostingInstitution !== inst.code) {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  <Building2 
                    size={24} 
                    style={{ 
                      color: currentPostingInstitution === inst.code ? '#3b82f6' : '#6b7280' 
                    }} 
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      fontSize: 16, 
                      fontWeight: 600, 
                      margin: 0,
                      color: currentPostingInstitution === inst.code ? '#1e40af' : '#1f2937'
                    }}>
                      {inst.name}
                    </h3>
                    <p style={{ 
                      fontSize: 13, 
                      color: '#6b7280', 
                      margin: '4px 0 0 0' 
                    }}>
                      {inst.address || inst.code}
                    </p>
                    {inst.contact_info && currentUser?.id_number !== '5274' && (
                      <p style={{ 
                        fontSize: 12, 
                        color: '#9ca3af', 
                        margin: '2px 0 0 0' 
                      }}>
                        {inst.contact_info}
                      </p>
                    )}
                  </div>
                  {currentPostingInstitution === inst.code && (
                    <CheckCircle size={24} className="text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No Institutions */}
          {!loading && institutions.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#6b7280'
            }}>
              <Building2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>No institutions available</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
