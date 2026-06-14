import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Plus, Edit, Trash2, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserSession } from '../utils/userSessionDB';
import ConfirmationModal from './ConfirmationModal';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdminAuthenticated: boolean;
  adminName?: string;
}

export const StaffManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  isAdminAuthenticated,
  adminName
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id_number: '',
    firstName: '',
    surname: '',
    passcode: '',
    is_admin: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'save' | 'delete' | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadCurrentUser();
    }
  }, [isOpen]);

  const loadCurrentUser = async () => {
    try {
      const session = await getUserSession();
      if (session) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.userId)
          .single();
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, id_number, surname, name, passcode, is_admin, is_active, last_login')
        .order('surname', { ascending: true });

      if (error) throw error;
      // Filter out admin users from the list
      const filteredUsers = (data || []).filter(user => !user.is_admin);
      setUsers(filteredUsers);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id_number: '',
      firstName: '',
      surname: '',
      passcode: '',
      is_admin: false
    });
    setEditingUser(null);
    setFormErrors({});
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      id_number: user.id_number || '',
      firstName: user.name || '',
      surname: user.surname || '',
      passcode: user.passcode || '',
      is_admin: user.is_admin || false
    });
    setShowForm(true);
  };

  const handleDelete = (user: any) => {
    if (user.id === currentUser?.id) {
      alert('Cannot delete your own account');
      return;
    }

    if (user.is_admin && currentUser?.id_number !== '5274') {
      alert('Cannot delete ADMIN account. Only master admin (5274) can delete admin accounts.');
      return;
    }

    setConfirmationAction('delete');
    setConfirmationMessage(`Are you sure you want to delete ${user.name}? This action cannot be undone.`);
    setEditingUser(user);
    setShowConfirmation(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.id_number.trim()) {
      errors.id_number = 'ID Number is required';
    } else if (!/^[A-Z0-9]{14}$/.test(formData.id_number)) {
      errors.id_number = 'ID Number must be exactly 14 alphanumeric characters';
    }

    if (!formData.surname.trim()) {
      errors.surname = 'Surname is required';
    }

    if (!formData.firstName.trim()) {
      errors.firstName = 'Name is required';
    }

    if (!editingUser && !formData.passcode) {
      errors.passcode = 'Passcode is required for new users';
    }

    if (formData.passcode && !/^\d{4}$/.test(formData.passcode)) {
      errors.passcode = 'Passcode must be 4 digits';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setConfirmationAction('save');
    setConfirmationMessage(
      editingUser
        ? `Are you sure you want to update ${formData.firstName} ${formData.surname}?`
        : `Are you sure you want to add ${formData.firstName} ${formData.surname}?`
    );
    setShowConfirmation(true);
  };

  const executeSave = async () => {
    setIsSaving(true);
    setFormErrors({});

    try {
      // Check if ID number already exists (for new users or changed ID)
      if (!editingUser || (editingUser && formData.id_number !== editingUser.id_number)) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id_number', formData.id_number)
          .single();

        if (existingUser && (!editingUser || existingUser.id !== editingUser.id)) {
          setFormErrors({ id_number: 'ID Number already exists' });
          setIsSaving(false);
          return;
        }
      }

      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            id_number: formData.id_number,
            surname: formData.surname.toUpperCase(),
            name: formData.firstName,
            passcode: formData.passcode || editingUser.passcode,
            is_admin: formData.is_admin,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        setSuccessMessage(`${formData.firstName} ${formData.surname} updated successfully!`);
      } else {
        // Add new user
        const { error } = await supabase
          .from('users')
          .insert({
            id_number: formData.id_number,
            surname: formData.surname.toUpperCase(),
            name: formData.firstName,
            passcode: formData.passcode,
            is_admin: formData.is_admin,
            is_active: true
          });

        if (error) throw error;
        setSuccessMessage(`${formData.firstName} ${formData.surname} added successfully!`);
      }

      await loadUsers();
      resetForm();
      setShowForm(false);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to save user:', err);
      setFormErrors({ submit: err.message || 'Failed to save user' });
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', editingUser.id);

      if (error) throw error;

      setSuccessMessage(`${editingUser.name} deleted successfully!`);
      await loadUsers();
      resetForm();
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to delete user:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmation = async () => {
    setShowConfirmation(false);
    
    if (confirmationAction === 'save') {
      await executeSave();
    } else if (confirmationAction === 'delete') {
      await executeDelete();
    }
    
    setConfirmationAction(null);
    setEditingUser(null);
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
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
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
            <User className="w-6 h-6 text-blue-600" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
              User Management
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
          {successMessage && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle className="w-5 h-5" />
              {successMessage}
            </div>
          )}

          {/* Add New Button */}
          {!loading && isAdminAuthenticated && (
            <button
              onClick={handleAddNew}
              style={{
                marginBottom: '16px',
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600
              }}
            >
              <Plus className="w-5 h-5" />
              Add New User
            </button>
          )}

          {/* User Form */}
          {showForm && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #e5e7eb'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0' }}>
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: formErrors.id_number ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                  {formErrors.id_number && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {formErrors.id_number}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Surname *
                  </label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: formErrors.surname ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                  {formErrors.surname && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {formErrors.surname}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: formErrors.firstName ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                  {formErrors.firstName && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {formErrors.firstName}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Passcode {!editingUser && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.passcode}
                    onChange={(e) => setFormData({ ...formData, passcode: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="4-digit code"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: formErrors.passcode ? '1px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px'
                    }}
                  />
                  {formErrors.passcode && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {formErrors.passcode}
                    </div>
                  )}
                </div>

                {formErrors.submit && (
                  <div
                    style={{
                      padding: '8px',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {formErrors.submit}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 600
                    }}
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>
                        {user.surname} {user.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                        ID: {user.id_number}
                      </div>
                    </div>

                    {isAdminAuthenticated && (
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEdit(user)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        title={confirmationAction === 'delete' ? 'Delete User' : 'Save User'}
        message={confirmationMessage}
        onConfirm={handleConfirmation}
        onCancel={() => {
          setShowConfirmation(false);
          setConfirmationAction(null);
          setEditingUser(null);
        }}
        confirmText={confirmationAction === 'delete' ? 'Delete' : 'Save'}
        isDanger={confirmationAction === 'delete'}
      />
    </div>,
    document.body
  );
};
