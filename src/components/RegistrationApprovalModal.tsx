import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, CheckCircle, XCircle, Clock, CheckSquare, XSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmationModal from './ConfirmationModal';

interface RegistrationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegistrationApprovalModal: React.FC<RegistrationApprovalModalProps> = ({
  isOpen,
  onClose
}) => {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectData, setRejectData] = useState<{id: string; name: string} | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false);
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPendingUsers();
    }
  }, [isOpen]);

  const loadPendingUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, just show all inactive users as "pending"
      // You can add a specific 'pending_approval' column later
      const { data, error } = await supabase
        .from('users')
        .select('id, id_number, surname, name, is_active, created_at')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, userName: string) => {
    setProcessingId(userId);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', userId);

      if (error) throw error;

      setSuccessMessage(`${userName} approved successfully!`);
      await loadPendingUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectData) return;

    setProcessingId(rejectData.id);
    setError(null);
    setSuccessMessage(null);

    try {
      // Delete the user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', rejectData.id);

      if (error) throw error;

      setSuccessMessage(`${rejectData.name} rejected and removed.`);
      setShowRejectConfirm(false);
      setRejectData(null);
      await loadPendingUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    setIsBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const userIds = pendingUsers.map(u => u.id);
      
      // Approve all users
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .in('id', userIds);

      if (error) throw error;

      setSuccessMessage(`All ${pendingUsers.length} users approved successfully!`);
      setShowApproveAllConfirm(false);
      await loadPendingUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve all users');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleRejectAll = async () => {
    setIsBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const userIds = pendingUsers.map(u => u.id);
      
      // Delete all users
      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', userIds);

      if (error) throw error;

      setSuccessMessage(`All ${pendingUsers.length} users rejected and removed.`);
      setShowRejectAllConfirm(false);
      await loadPendingUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject all users');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users className="w-6 h-6 text-blue-600" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
              Registration Approval
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            >
              {successMessage}
            </div>
          )}

          {/* Bulk Action Buttons - Show when more than 1 pending user */}
          {pendingUsers.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
              <button
                onClick={() => setShowApproveAllConfirm(true)}
                disabled={isBulkProcessing}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  opacity: isBulkProcessing ? 0.5 : 1
                }}
              >
                <CheckSquare className="w-5 h-5" />
                {isBulkProcessing ? 'Processing...' : `Approve All (${pendingUsers.length})`}
              </button>

              <button
                onClick={() => setShowRejectAllConfirm(true)}
                disabled={isBulkProcessing}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  opacity: isBulkProcessing ? 0.5 : 1
                }}
              >
                <XSquare className="w-5 h-5" />
                {isBulkProcessing ? 'Processing...' : `Reject All (${pendingUsers.length})`}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading...
            </div>
          ) : pendingUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending registrations</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '16px' }}>
                      {user.surname} {user.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                      ID: {user.id_number}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleApprove(user.id, `${user.name} ${user.surname}`)}
                      disabled={processingId === user.id}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: processingId === user.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: processingId === user.id ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {processingId === user.id ? 'Processing...' : 'Approve'}
                    </button>

                    <button
                      onClick={() => {
                        setRejectData({
                          id: user.id,
                          name: `${user.name} ${user.surname}`
                        });
                        setShowRejectConfirm(true);
                      }}
                      disabled={processingId === user.id}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: processingId === user.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: processingId === user.id ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Reject Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectConfirm}
        title="Reject Registration"
        message={`Are you sure you want to reject ${rejectData?.name}? This will permanently delete their account.`}
        onConfirm={handleReject}
        onCancel={() => {
          setShowRejectConfirm(false);
          setRejectData(null);
        }}
        confirmText="Reject"
        isDanger={true}
      />

      {/* Approve All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveAllConfirm}
        title="Approve All Registrations"
        message={`Are you sure you want to approve all ${pendingUsers.length} pending registrations?`}
        onConfirm={handleApproveAll}
        onCancel={() => setShowApproveAllConfirm(false)}
        confirmText="Approve All"
        isDanger={false}
      />

      {/* Reject All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectAllConfirm}
        title="Reject All Registrations"
        message={`Are you sure you want to reject and delete all ${pendingUsers.length} pending registrations? This action cannot be undone.`}
        onConfirm={handleRejectAll}
        onCancel={() => setShowRejectAllConfirm(false)}
        confirmText="Reject All"
        isDanger={true}
      />
    </div>,
    document.body
  );
};
