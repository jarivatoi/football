import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StaffUser, Institution } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { generateRosterDisplayName, updateDuplicateDisplayNames } from '../utils/rosterDisplayName';
import { convertAnonymousToReal } from '../utils/anonymousUsers';

interface RegistrationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser: StaffUser | null;
}

interface PendingRegistration {
  id: string;
  surname: string;
  name: string;
  id_number: string;
  institution_code: string;
  created_at: string;
  institution_name?: string;
}

export const RegistrationApprovalModal = ({
  isOpen,
  onClose,
  adminUser
}: RegistrationApprovalModalProps) => {
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectData, setRejectData] = useState<{id: string; name: string} | null>(null);
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false);

  // Load institutions
  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setInstitutions(data || []);
      } catch (err) {
        console.error('Error loading institutions:', err);
      }
    };
    
    loadInstitutions();
  }, []);

  // Load pending registrations
  const loadPendingRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('staff_users')
        .select('id, surname, name, id_number, institution_code, created_at')
        .eq('registration_approved', false)
        .order('created_at', { ascending: false });
      
      // Filter by admin's institution (except Admin 5274 who sees all)
      const isAdmin5274 = adminUser?.id_number?.endsWith('5274');
      
      if (!isAdmin5274 && adminUser?.institution_code) {
        query = query.eq('institution_code', adminUser.institution_code);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get institution names (handle case where institutions might not be loaded)
      const registrationsWithNames = (data as PendingRegistration[]).map(reg => ({
        ...reg,
        institution_name: institutions?.find(i => i.code === reg.institution_code)?.name || reg.institution_code || 'Unknown'
      })) || [];
      
      console.log('✅ Loaded pending registrations:', registrationsWithNames.length);
      setPendingRegistrations(registrationsWithNames);
    } catch (err: any) {
      console.error('Error loading pending registrations:', err);
      setError(err.message || 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPendingRegistrations();
    }
  }, [isOpen]); // Removed institutions dependency to prevent loop

  const handleApprove = async (registrationId: string, staffName: string) => {
    try {
      setProcessingId(registrationId);
      setError(null);
      setSuccessMessage(null);
      
      // First, get the staff member's details
      const { data: staffData, error: fetchError } = await supabase
        .from('staff_users')
        .select('id, surname, name, id_number, institution_code')
        .eq('id', registrationId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!staffData) throw new Error('Staff member not found');
      
      // Generate proper display name (checking for duplicates in same institution)
      const rosterDisplayName = await generateRosterDisplayName({
        surname: staffData.surname,
        name: staffData.name,
        idNumber: staffData.id_number,
        institutionCode: staffData.institution_code
      });
      
      console.log(`🔄 Approving ${staffName} with display name: ${rosterDisplayName}`);
      
      // Update registration approval AND set display name
      const { error } = await supabase
        .from('staff_users')
        .update({
          registration_approved: true,
          approved_by: adminUser?.id,
          approved_at: new Date().toISOString(),
          roster_display_name: rosterDisplayName
        })
        .eq('id', registrationId);
      
      if (error) throw error;
      
      // 🆕 NEW: Search for anonymous placeholder and convert to real user
      console.log(`🔍 Searching for anonymous placeholder with surname: ${staffData.surname}`);
      const conversionResult = await convertAnonymousToReal(
        staffData.surname,
        staffData.id_number,
        staffData.name
      );
      
      if (conversionResult.updated) {
        console.log(`✅ Converted anonymous placeholder: ${conversionResult.previousPlaceholderId} → ${conversionResult.newId}`);
        setSuccessMessage(`✅ ${staffName} has been approved successfully! Anonymous placeholder converted.`);
        
        // Also update roster entries that reference the old placeholder ID
        if (conversionResult.previousPlaceholderId && conversionResult.newId) {
          await updateRosterEntriesForConvertedUser(
            conversionResult.previousPlaceholderId,
            conversionResult.newId,
            rosterDisplayName
          );
        }
      } else {
        setSuccessMessage(`✅ ${staffName} has been approved successfully!`);
      }
      
      // After approval, check if we need to update other staff with same surname
      console.log(`🔄 Checking if other ${staffData.surname.toUpperCase()} staff need display name updates...`);
      await updateDuplicateDisplayNames({
        surname: staffData.surname,
        institutionCode: staffData.institution_code || ''
      });
      
      // Reload list
      await loadPendingRegistrations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.message || 'Failed to approve registration');
    } finally {
      setProcessingId(null);
    }
  };

  // Helper function to update roster entries when anonymous user is converted
  const updateRosterEntriesForConvertedUser = async (
    oldPlaceholderId: string,
    newRealId: string,
    newDisplayName: string
  ) => {
    try {
      console.log(`🔄 Updating roster entries from ${oldPlaceholderId} to ${newRealId}`);
      
      // Find all roster entries with the old placeholder assigned_name
      const { data: oldEntries } = await supabase
        .from('roster_entries')
        .select('id, assigned_name')
        .like('assigned_name', `%${oldPlaceholderId}%`);
      
      if (oldEntries && oldEntries.length > 0) {
        console.log(`📊 Found ${oldEntries.length} roster entries to update`);
        
        // Update each entry to use the new real ID
        for (const entry of oldEntries) {
          const newAssignedName = entry.assigned_name.replace(oldPlaceholderId, newRealId);
          
          await supabase
            .from('roster_entries')
            .update({
              assigned_name: newAssignedName,
              roster_display_name: newDisplayName
            })
            .eq('id', entry.id);
        }
        
        console.log(`✅ Updated ${oldEntries.length} roster entries`);
      }
    } catch (error) {
      console.error('❌ Error updating roster entries:', error);
      // Don't throw - this is a bonus update, not critical
    }
  };

  const handleReject = async (registrationId: string, staffName: string) => {
    setShowRejectConfirm(false);
    setRejectData(null);
    
    try {
      setProcessingId(registrationId);
      setError(null);
      setSuccessMessage(null);
      
      // Delete the unapproved user
      const { error } = await supabase
        .from('staff_users')
        .delete()
        .eq('id', registrationId);
      
      if (error) throw error;
      
      setSuccessMessage(`❌ ${staffName}'s registration has been rejected.`);
      
      // Reload list
      await loadPendingRegistrations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Rejection error:', err);
      setError(err.message || 'Failed to reject registration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    setShowApproveAllConfirm(true);
  };

  const handleConfirmBulkApprove = async () => {
    setShowApproveAllConfirm(false);
    
    try {
      setProcessingId('bulk');
      setError(null);
      setSuccessMessage(null);
      
      const ids = pendingRegistrations.map(r => r.id);
      
      const { error } = await supabase
        .from('staff_users')
        .update({
          registration_approved: true,
          approved_by: adminUser?.id,
          approved_at: new Date().toISOString()
        })
        .in('id', ids);
      
      if (error) throw error;
      
      setSuccessMessage(`✅ Approved ${ids.length} registrations successfully!`);
      
      // Reload list
      await loadPendingRegistrations();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Bulk approval error:', err);
      setError(err.message || 'Failed to approve registrations');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelBulkApprove = () => {
    setShowApproveAllConfirm(false);
  };

  if (!isOpen) return null;

  const isAdmin5274 = adminUser?.id_number?.endsWith('5274');

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
        maxWidth: 800,
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
            <h2 style={{ fontSize: 20, marginBottom: 5 }}>Registration Approvals</h2>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              {isAdmin5274 ? 'All Institutions' : `Your Institution: ${adminUser?.institution_code}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: '#6b7280'
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
              <CheckCircle size={20} className="text-green-600" />
              <span style={{ color: '#065f46' }}>{successMessage}</span>
            </div>
          )}
          
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={20} className="text-red-600" />
              <span style={{ color: '#991b1b' }}>{error}</span>
            </div>
          )}

          {/* Bulk Approve Button */}
          {pendingRegistrations.length > 1 && (
            <button
              onClick={handleBulkApprove}
              disabled={processingId === 'bulk'}
              style={{
                padding: '10px 16px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: processingId === 'bulk' ? 'not-allowed' : 'pointer',
                opacity: processingId === 'bulk' ? 0.7 : 1,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <CheckCircle size={18} />
              {processingId === 'bulk' ? 'Processing...' : `Approve All (${pendingRegistrations.length})`}
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Clock size={48} className="animate-spin" style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <p>Loading pending registrations...</p>
            </div>
          )}

          {/* No Pending Registrations */}
          {!loading && pendingRegistrations.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#6b7280'
            }}>
              <CheckCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p>No pending registrations awaiting approval</p>
            </div>
          )}

          {/* Registration List */}
          {!loading && pendingRegistrations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingRegistrations.map(reg => (
                <div
                  key={reg.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    background: '#f9fafb'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12
                  }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                        {reg.surname} {reg.name}
                      </h3>
                      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                        ID: {reg.id_number}
                      </p>
                      <p style={{ fontSize: 14, color: '#6b7280' }}>
                        Hospital: {reg.institution_name}
                      </p>
                      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        Registered: {new Date(reg.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleApprove(reg.id, `${reg.surname} ${reg.name}`)}
                        disabled={processingId === reg.id}
                        style={{
                          padding: '8px 16px',
                          background: '#059669',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: processingId === reg.id ? 'not-allowed' : 'pointer',
                          opacity: processingId === reg.id ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <CheckCircle size={16} />
                        {processingId === reg.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectData({ id: reg.id, name: `${reg.surname} ${reg.name}` });
                          setShowRejectConfirm(true);
                        }}
                        disabled={processingId === reg.id}
                        style={{
                          padding: '8px 16px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: processingId === reg.id ? 'not-allowed' : 'pointer',
                          opacity: processingId === reg.id ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <XCircle size={16} />
                        {processingId === reg.id ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rejection Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectConfirm}
        title="Reject Registration"
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p>Are you sure you want to reject the registration for:</p>
            <p style={{ fontWeight: 600, color: '#dc2626' }}>{rejectData?.name}</p>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>This action cannot be undone. The user will need to register again.</p>
          </div>
        }
        onConfirm={() => rejectData && handleReject(rejectData.id, rejectData.name)}
        onCancel={() => {
          setShowRejectConfirm(false);
          setRejectData(null);
        }}
        confirmText="Reject"
        cancelText="Cancel"
        isDanger={true}
      />

      {/* Approve All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveAllConfirm}
        title="Approve All Registrations"
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p>Are you sure you want to approve all <strong style={{ color: '#059669' }}>{pendingRegistrations.length}</strong> pending registrations?</p>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>This will grant all users access to the system and generate their roster display names.</p>
          </div>
        }
        onConfirm={handleConfirmBulkApprove}
        onCancel={handleCancelBulkApprove}
        confirmText="Approve All"
        cancelText="Cancel"
        isDanger={false}
      />
    </div>,
    document.body
  );
};
