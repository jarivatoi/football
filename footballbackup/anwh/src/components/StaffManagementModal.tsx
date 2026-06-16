import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Plus, Edit, Trash2, Save, AlertTriangle, CheckCircle, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Institution } from '../types';
import { getUserSession } from '../utils/indexedDB';
import { generateRosterDisplayName, updateStaffDisplayName, updateDuplicateDisplayNames } from '../utils/rosterDisplayName';
import { syncRosterEntriesForStaff } from '../utils/rosterApi';
import { NicknameEditorModal } from './NicknameEditor';

// Define the props interface
interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdminAuthenticated: boolean;
  adminName: string | null;
}

// Define staff user interface
interface StaffUser {
  id: string;
  id_number: string;
  surname: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  passcode?: string | null;
  salary?: number;
  title?: string;
  institution_code?: string;
  posting_institution?: string | null;
  nickname?: string;
}

// Define the form data interface
interface StaffFormData {
  id_number: string;
  salary: number;
  firstName: string;
  surname: string;
  title: string;
  institution_code?: string;
  posting_institution?: string;
  passcode?: string;
  is_admin?: boolean;
  nickname?: string;
}

export const StaffManagementModal = ({
  isOpen,
  onClose,
  isAdminAuthenticated,
  adminName
}: StaffManagementModalProps) => {
  const [staffMembers, setStaffMembers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>({
    id_number: '',
    salary: 0,
    firstName: '',
    surname: '',
    title: 'MIT',
    institution_code: '',
    passcode: '',
    is_admin: false
  });
  const [confirmIdNumber, setConfirmIdNumber] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'save' | 'delete' | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [adminPrivilegeError, setAdminPrivilegeError] = useState('');
  const [filterInstitution, setFilterInstitution] = useState<string>('all');
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [editingNicknameFor, setEditingNicknameFor] = useState<StaffUser | null>(null);

  // Load staff members from Supabase
  const loadStaffMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .order('surname', { ascending: true });

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load institutions for dropdown
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
      } catch (error) {
        console.error('Error loading institutions:', error);
      }
    };

    // Load current user
    const loadCurrentUser = async () => {
      try {
        // Use IndexedDB (new method) instead of localStorage
        const session = await getUserSession();
        
        if (session) {
          const { data: userData, error } = await supabase
            .from('staff_users')
            .select('*')
            .eq('id', session.userId)
            .single();
          
          if (error) {
            console.error('❌ Error fetching user data:', error);
          }
          
          setCurrentUser(userData || null);
        } else {
          console.warn('⚠️ No session found in IndexedDB');
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };
    
    loadInstitutions();
    loadCurrentUser();
  }, []);

  // Load staff on mount
  useEffect(() => {
    loadStaffMembers();
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadStaffMembers(); // Reload staff when modal opens
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open - CRITICAL for iOS
  useEffect(() => {
    if (isOpen) {
      console.log('📱 StaffManagementModal: Opening modal, locking body scroll');
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      const originalTop = window.getComputedStyle(document.body).top;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      
      return () => {
        console.log('📱 StaffManagementModal: Closing modal, restoring body scroll');
        document.body.style.overflow = originalStyle;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.bottom = '';
      };
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      id_number: '',
      salary: 0,
      firstName: '',
      surname: '',
      title: 'MIT',
      institution_code: '',
      passcode: '',
      is_admin: false
    });
    setConfirmIdNumber('');
    setFormErrors({});
    setEditingStaff(null);
    setShowForm(false);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.id_number.trim()) {
      errors.id_number = 'ID number is required';
    } else if (!/^[A-Z0-9]{14}$/.test(formData.id_number)) {
      errors.id_number = 'ID number must be exactly 14 alphanumeric characters (A-Z, 0-9)';
    } else if (staffMembers.some((staff) => staff.id_number === formData.id_number && staff.id !== editingStaff?.id)) {
      errors.id_number = 'ID number already exists';
    }

    // Validate confirm ID number for new staff (not when editing)
    if (!editingStaff && formData.id_number !== confirmIdNumber) {
      errors.confirmIdNumber = 'ID numbers do not match';
    }

    if (!formData.surname.trim()) {
      errors.surname = 'Surname is required';
    }

    // Validate institution selection - COMPULSORY
    if (!formData.institution_code || !formData.institution_code.trim()) {
      errors.institution_code = 'Hospital/Institution selection is compulsory';
    }

    if (formData.salary < 0) {
      errors.salary = 'Salary must be positive';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate admin privilege - max 2 local admins per institution
  // Admin 5274 (master admin) can be posted to any institution regardless of this limit
  const validateAdminPrivilege = async (institutionCode: string | null, targetUserId?: string): Promise<boolean> => {
    if (!institutionCode) {
      setAdminPrivilegeError('Institution is required to grant admin privileges');
      return false;
    }

    // Count existing LOCAL admins for this institution (excluding main admin 5274)
    const existingAdmins = staffMembers.filter(
      staff => staff.institution_code === institutionCode && 
               staff.is_admin && 
               staff.id !== targetUserId &&
               staff.id_number !== '5274' &&
               staff.id_number !== 'admin-5274'
    );

    // Allow up to 2 local admins per institution
    // Admin 5274 (master admin) can be posted to any institution regardless of this limit
    if (existingAdmins.length >= 2) {
      const adminNames = existingAdmins.map(a => `${a.name} (${a.id_number})`).join(', ');
      setAdminPrivilegeError(`Cannot grant admin privileges: Maximum 2 local admins already assigned to ${institutionCode}: ${adminNames}`);
      return false;
    }

    setAdminPrivilegeError('');
    return true;
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (staff: StaffUser) => {
    setEditingStaff(staff);
    setFormData({
      id_number: staff.id_number || '',
      salary: staff.salary || 0,
      firstName: staff.name || '',
      surname: staff.surname || '',
      title: staff.title || 'MIT',
      institution_code: staff.institution_code || '',
      passcode: staff.passcode || '',
      is_admin: staff.is_admin || false,
      nickname: staff.nickname || ''
    });
    setConfirmIdNumber(staff.id_number || ''); // Pre-fill for editing
    setShowForm(true);
  };

  const handleDelete = (staff: StaffUser) => {
    // Prevent deleting yourself
    if (staff.id === currentUser?.id) {
      alert('Cannot delete your own account');
      return;
    }
    
    // Only admin 5274 can delete other admin accounts
    if (staff.is_admin && currentUser?.id_number !== '5274') {
      alert('Cannot delete ADMIN account. Only master admin (5274) can delete admin accounts.');
      return;
    }
    
    setConfirmationAction('delete');
    setConfirmationMessage(`Are you sure you want to delete ${staff.name}? This action cannot be undone.`);
    setEditingStaff(staff);
    setShowConfirmation(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // Validate admin privilege if granting admin access
    if (formData.is_admin && formData.institution_code) {
      const isValid = await validateAdminPrivilege(formData.institution_code, editingStaff?.id);
      if (!isValid) {
        return;
      }
    }

    setConfirmationAction('save');
    setConfirmationMessage(
      editingStaff 
        ? `Save changes to ${formData.firstName} ${formData.surname}?`
        : `Add new staff member ${formData.firstName} ${formData.surname}?`
    );
    setShowConfirmation(true);
  };

  const handleConfirmAction = async () => {
    setIsSaving(true);
    
    try {
      if (confirmationAction === 'save') {
        // Passcodes can be duplicated - ID number is the unique identifier
        // No need to check for passcode uniqueness
        
        const staffData: any = {
          id_number: formData.id_number,
          surname: formData.surname.toUpperCase(),
          name: formData.firstName || formData.surname,
          salary: formData.salary,
          title: formData.title || 'MIT',
          institution_code: formData.institution_code || null,
          is_admin: formData.is_admin || false
        };

        // Only update passcode if it's provided and not empty
        if (formData.passcode && formData.passcode.trim()) {
          staffData.passcode = formData.passcode; // Can be duplicated now
        }

        if (editingStaff) {
          // Update existing staff - regenerate roster_display_name if surname or id_number changed
          if (staffData.surname !== editingStaff.surname || staffData.id_number !== editingStaff.id_number || staffData.name !== editingStaff.name) {
            // Use the new updateStaffDisplayName function which handles simplification
            const rosterDisplayName = await updateStaffDisplayName({
              staffId: editingStaff.id,
              oldSurname: editingStaff.surname,
              oldName: editingStaff.name,
              newSurname: staffData.surname,
              newName: staffData.name || editingStaff.name,
              idNumber: staffData.id_number || editingStaff.id_number,
              institutionCode: staffData.institution_code || editingStaff.institution_code
            });
            staffData.roster_display_name = rosterDisplayName;
          }
          
          // Update existing staff
          console.log('🔄 Updating staff member:', editingStaff.id, 'with data:', staffData);
          const { data, error } = await supabase
            .from('staff_users')
            .update(staffData)
            .eq('id', editingStaff.id)
            .select();

          console.log('💾 Update result:', { data, error });
          if (error) {
            console.error('❌ Supabase update error:', error);
            throw error;
          }
          
          // Synchronize roster entries if name or ID changed
          if (staffData.surname !== editingStaff.surname || staffData.id_number !== editingStaff.id_number || staffData.name !== editingStaff.name) {
            console.log(`🔄 Syncing roster entries for ${editingStaff.id_number} → ${staffData.roster_display_name}`);
            await syncRosterEntriesForStaff(
              editingStaff.id_number || staffData.id_number,
              staffData.roster_display_name
            );
            
            // After updating roster entries, refresh other staff with same surname to check for simplification
            console.log(`🔄 Checking if other ${staffData.surname.toUpperCase()} staff can simplify...`);
            await updateDuplicateDisplayNames({
              surname: staffData.surname,
              institutionCode: staffData.institution_code || ''
            });
          }
          
          setSuccessMessage(`${formData.firstName} ${formData.surname} updated successfully!`);
          
          // Dispatch event to notify parent components (like AdminPanel) to refresh
          window.dispatchEvent(new CustomEvent('staffListChanged'));
        } else {
          // Add new staff - generate roster_display_name with ID
          const rosterDisplayName = await generateRosterDisplayName({
            surname: formData.surname,
            name: formData.firstName || formData.surname,
            idNumber: formData.id_number,
            institutionCode: formData.institution_code || null
          });
          
          const newId = crypto.randomUUID();
          const newStaffData = {
            ...staffData,
            id: newId,
            roster_display_name: rosterDisplayName,
            registration_approved: false,  // Require admin approval before first login
            is_admin: false,
            is_active: true
          };

          const { error } = await supabase
            .from('staff_users')
            .insert(newStaffData);

          if (error) throw error;
          
          // After inserting new staff, check if we need to update other staff with same surname
          console.log(`🔄 Checking if other ${formData.surname.toUpperCase()} staff need display name updates...`);
          await updateDuplicateDisplayNames({
            surname: formData.surname,
            institutionCode: formData.institution_code || ''
          });
          
          setSuccessMessage(`${formData.firstName} ${formData.surname} added successfully!`);
        }
        
        // Refresh staff data
        await loadStaffMembers();
        
        // Dispatch event to notify parent components (like AdminPanel) to refresh
        window.dispatchEvent(new CustomEvent('staffListChanged'));
        
        resetForm();
      } else if (confirmationAction === 'delete' && editingStaff) {
        // Delete staff
        const { error } = await supabase
          .from('staff_users')
          .delete()
          .eq('id', editingStaff.id);

        if (error) throw error;
        
        setSuccessMessage(`${editingStaff.name} deleted successfully!`);
        
        // Refresh staff data
        await loadStaffMembers();
        
        // Dispatch event to notify parent components (like AdminPanel) to refresh
        window.dispatchEvent(new CustomEvent('staffListChanged'));
        
        resetForm();
      }
      
      // Show success message
      setTimeout(() => setSuccessMessage(''), 5000);
      
    } catch (error) {
      console.error('💥 Save failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code || 'N/A';
      alert(`Failed to save changes: ${errorMessage}

Error Code: ${errorCode}

If this is a duplicate passcode error, please choose a different passcode.`);
      setSuccessMessage(''); // Clear any success message if there was an error
    } finally {
      setIsSaving(false);
      setShowConfirmation(false);
      setConfirmationAction(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setConfirmationAction(null);
    setConfirmationMessage('');
  };

  const handleFormChange = (field: keyof StaffFormData, value: string | number | boolean) => {
    setFormData((prev: StaffFormData) => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev: Record<string, string>) => ({ ...prev, [field]: '' }));
    }
    
    // Clear admin privilege error when changing institution or admin status
    if (field === 'institution_code' || field === 'is_admin') {
      setAdminPrivilegeError('');
    }
  };

  if (!isOpen) return null;

  // Filter staff list based on current user's role and institution
  const displayStaffList = staffMembers.filter((staff) => {
    // Always exclude the main admin (5274) from the list
    if (staff.id_number === '5274') {
      return false;
    }
    
    // If current user is main admin (5274), show ALL staff from all institutions
    // INCLUDING other admins (they need to see who they granted privileges to)
    const isMainAdmin = currentUser?.id_number === '5274';
    
    if (isMainAdmin) {
      // Apply institution filter if selected
      if (filterInstitution !== 'all' && staff.institution_code !== filterInstitution) {
        return false;
      }
      return true; // Show all staff except 5274
    }
    
    // For institution-specific admins, show only staff from their institution
    // Include themselves and other staff, but exclude other admins
    if (currentUser?.institution_code) {
      // Show all staff from same institution (including self)
      const result = staff.institution_code === currentUser.institution_code;
      return result;
    }
    
    // Default: show non-admin staff
    const defaultResult = !staff.is_admin;
    return defaultResult;
  });
  
  // Modal content JSX - separated for clarity (like BatchPrintModal)
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: window.innerWidth > window.innerHeight ? '4px' : '16px',
        paddingTop: window.innerWidth > window.innerHeight ? '2px' : '16px',
        overflow: 'auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // Force hardware acceleration on iOS
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden'
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !showConfirmation) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{
          maxWidth: window.innerWidth > window.innerHeight ? '98vw' : '28rem',
          maxHeight: window.innerWidth > window.innerHeight ? '98vh' : '95vh',
          margin: window.innerWidth > window.innerHeight ? '2px 0' : '8px 0',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          // Force hardware acceleration
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden'
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 flex-shrink-0 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Staff Management</h3>
                <p className="text-sm text-gray-600">
                  Manage staff details and passcodes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={showConfirmation}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">{successMessage}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          {!showForm ? (
            /* Staff List View */
            <div className="space-y-4">
              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin" />
                  <span className="ml-3 text-gray-600">Loading staff data...</span>
                </div>
              )}

              {/* Add New Button */}
              {!loading && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Staff Members ({displayStaffList.length})
                    </h4>
                    {/* Institution Filter - Only show for main admin 5274 */}
                    {currentUser?.id_number === '5274' && (
                      <select
                        value={filterInstitution}
                        onChange={(e) => setFilterInstitution(e.target.value)}
                        disabled={!isAdminAuthenticated}
                        style={{
                          marginLeft: '8px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: 'white'
                        }}
                        title="Filter by institution..."
                      >
                        <option value="all">All Institutions</option>
                        {Array.from(new Set(staffMembers.map(s => s.institution_code).filter(Boolean))).sort().map(inst => (
                          <option key={inst} value={inst}>{inst}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    onClick={handleAddNew}
                    disabled={!isAdminAuthenticated}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New</span>
                  </button>
                </div>
              )}

              {/* Staff List */}
              {!loading && (
                <div className="space-y-3">
                {displayStaffList.map((staff) => (
                  <div 
                    key={staff.id} 
                    className={`rounded-lg p-4 border ${
                      staff.is_admin 
                        ? 'bg-green-50 border-green-300' 
                        : !staff.is_active 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col space-y-3">
                      {/* Staff Information */}
                      <div>
                        <div className="mb-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                              {staff.id_number || 'N/A'}
                            </span>
                            <span className="font-semibold text-gray-900">{staff.surname} {staff.name}</span>
                            {/* Nickname Indicator */}
                            {staff.nickname && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                📝 {staff.nickname}
                              </span>
                            )}
                            {/* Edit Nickname Button - Only for Admin 5274 */}
                            {currentUser?.id_number === '5274' && (
                              <button
                                onClick={() => {
                                  setEditingNicknameFor(staff);
                                  setShowNicknameEditor(true);
                                }}
                                title="Edit Nickname"
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            {/* Status Badge - Moved here before Title */}
                            <div>
                              <span className="font-medium">Status:</span>{' '}
                              {staff.is_admin ? (
                                <span className="text-xs font-medium bg-green-600 text-white px-2 py-0.5 rounded">Admin</span>
                              ) : (
                                <span className="text-xs font-medium bg-gray-600 text-white px-2 py-0.5 rounded">User</span>
                              )}
                              {!staff.is_active && (
                                <span className="text-xs font-medium bg-red-600 text-white px-2 py-0.5 rounded ml-1">Disabled</span>
                              )}
                            </div>
                            <div>
                              <span className="font-medium">Title:</span> {staff.title || 'MIT'}
                            </div>
                            <div>
                              <span className="font-medium">Salary:</span> Rs {staff.salary?.toLocaleString() || '0'}
                            </div>
                          </div>
                          {/* Institution Code - Visible for all users */}
                          {staff.institution_code && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">🏥 Institution:</span> {staff.institution_code}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons - Below staff info */}
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => handleEdit(staff)}
                          disabled={!isAdminAuthenticated}
                          className="w-full sm:flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          disabled={!isAdminAuthenticated}
                          className="w-full sm:flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          ) : (
            /* Add/Edit Form */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h4>
                <button
                  onClick={resetForm}
                  className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ID Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff ID Number *
                  </label>
                  <input
                    type="text"
                    value={formData.id_number}
                    onChange={(e) => {
                      const cursorPosition = e.target.selectionStart;
                      handleFormChange('id_number', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14));
                      // Restore cursor position after state update
                      setTimeout(() => {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                      }, 0);
                    }}
                    disabled={!isAdminAuthenticated || !!editingStaff}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono ${
                      formErrors.id_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter unique staff ID (14 characters)"
                    maxLength={14}
                    autoCapitalize="characters"
                  />
                  {formErrors.id_number && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.id_number}</p>
                  )}
                </div>

                {/* Confirm ID Number - Only for new staff */}
                {!editingStaff && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm ID Number *
                    </label>
                    <input
                      type="text"
                      value={confirmIdNumber}
                      onChange={(e) => {
                        const cursorPosition = e.target.selectionStart;
                        setConfirmIdNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                        // Restore cursor position after state update
                        setTimeout(() => {
                          e.target.setSelectionRange(cursorPosition, cursorPosition);
                        }, 0);
                      }}
                      disabled={!isAdminAuthenticated}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono ${
                        formErrors.confirmIdNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Re-enter staff ID (14 characters)"
                      maxLength={14}
                      autoCapitalize="characters"
                    />
                    {formErrors.confirmIdNumber && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.confirmIdNumber}</p>
                    )}
                  </div>
                )}

                {/* Surname */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Surname *
                  </label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => {
                      const cursorPosition = e.target.selectionStart;
                      handleFormChange('surname', e.target.value.toUpperCase());
                      // Restore cursor position after state update
                      setTimeout(() => {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                      }, 0);
                    }}
                    disabled={!isAdminAuthenticated}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center ${
                      formErrors.surname ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter surname"
                  />
                  {formErrors.surname && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.surname}</p>
                  )}
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => {
                      const cursorPosition = e.target.selectionStart;
                      handleFormChange('firstName', e.target.value);
                      // Restore cursor position after state update
                      setTimeout(() => {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                      }, 0);
                    }}
                    disabled={!isAdminAuthenticated}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                  />
                </div>

                {/* Passcode with Toggle - Only visible for new staff or when editing */}
                {/* Passcode field hidden for other admins when editing - only Admin 5274 can see it */}
                {(!editingStaff || currentUser?.id_number === '5274') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🔐 Passcode {editingStaff ? '(optional - leave empty to keep existing)' : '*'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPasscode ? 'text' : 'password'}
                        value={formData.passcode || ''}
                        onChange={(e) => handleFormChange('passcode', e.target.value)}
                        disabled={!isAdminAuthenticated}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono pr-12"
                        placeholder={editingStaff ? "Enter new passcode" : "4-digit passcode"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasscode(!showPasscode)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showPasscode ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {!editingStaff && (
                      <p className="mt-1 text-xs text-gray-500">Enter a 4-digit passcode</p>
                    )}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    disabled={!isAdminAuthenticated}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MIT">MIT</option>
                    <option value="SMIT">SMIT</option>
                  </select>
                </div>

                {/* Hospital/Institution - COMPULSORY */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏥 Hospital/Institution <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.institution_code || ''}
                    onChange={(e) => handleFormChange('institution_code', e.target.value)}
                    disabled={!isAdminAuthenticated}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center ${
                      formErrors.institution_code ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Hospital (Required)</option>
                    {institutions.map(inst => (
                      <option key={inst.code} value={inst.code}>{inst.name}</option>
                    ))}
                  </select>
                  {formErrors.institution_code && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.institution_code}</p>
                  )}
                  {!formErrors.institution_code && (
                    <p className="mt-1 text-xs text-gray-500">Assign staff to their hospital</p>
                  )}
                </div>

                {/* Salary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Salary (Rs)
                  </label>
                  <input
                    type="number"
                    value={formData.salary === 0 ? '' : formData.salary}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFormChange('salary', value === '' ? 0 : parseFloat(value) || 0);
                    }}
                    disabled={!isAdminAuthenticated}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center ${
                      formErrors.salary ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0"
                    min="0"
                  />
                  {formErrors.salary && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.salary}</p>
                  )}
                </div>

                {/* Admin Privilege Checkbox - ONLY visible to main admin 5274 */}
                {currentUser?.id_number === '5274' && (
                  <div>
                    <label className={`flex items-center space-x-2 text-sm font-medium ${
                      formData.institution_code && (() => {
                        // Count existing LOCAL admins in selected institution (excluding Admin 5274)
                        const adminCount = staffMembers.filter(s => 
                          s.institution_code === formData.institution_code && 
                          s.is_admin && 
                          s.id !== editingStaff?.id &&
                          s.id_number !== '5274' &&
                          s.id_number !== 'admin-5274'
                        ).length;
                        
                        const isPostedHere = currentUser?.posting_institution === formData.institution_code;
                        
                        // Total admins = existing local admins + Admin 5274 (if posted here)
                        // Don't count the person being edited yet - only count current admins
                        const totalCount = adminCount + (isPostedHere ? 1 : 0);
                        
                        // Max total admins:
                        // - If 5274 posted here: 2 locals + 5274 = 3 total
                        // - If 5274 NOT posted here: 2 locals = 2 total
                        const maxTotal = isPostedHere ? 3 : 2;
                        
                        // Max LOCAL admins allowed (for adding more):
                        // - If 5274 posted here: can have 2 locals
                        // - If 5274 NOT posted here: can have 2 locals
                        const maxLocalAllowed = 2;
                        
                        if (totalCount >= maxTotal) {
                          return <span className="text-xs text-red-600 ml-2">(Max {maxTotal} admin{maxTotal > 1 ? 's' : ''} reached for {formData.institution_code})</span>;
                        } else if (totalCount > 0) {
                          return <span className="text-xs text-orange-600 ml-2">({totalCount}/{maxTotal} admin{maxTotal > 1 ? 's' : ''})</span>;
                        }
                        return null;
                      })()
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-gray-700 cursor-pointer'
                    } mb-2`}>
                      <input
                        type="checkbox"
                        checked={!!formData.is_admin}
                        onChange={(e) => handleFormChange('is_admin', e.target.checked)}
                        disabled={!isAdminAuthenticated || !!(formData.institution_code && (() => {
                          // Count existing LOCAL admins in selected institution (excluding Admin 5274)
                          const adminCount = staffMembers.filter(s => 
                            s.institution_code === formData.institution_code && 
                            s.is_admin && 
                            s.id !== editingStaff?.id &&
                            s.id_number !== '5274' &&
                            s.id_number !== 'admin-5274'
                          ).length;
                          
                          // Check if Admin 5274 is posted to this institution
                          const isPostedHere = currentUser?.posting_institution === formData.institution_code;
                          
                          // Max allowed LOCAL admins per institution:
                          // Every institution can have up to 2 local admins
                          // If 5274 is also posted there, total becomes 3 (5274 + 2 locals)
                          const maxAllowed = 2;
                          
                          // CRITICAL: When EDITING an existing admin, NEVER disable the checkbox
                          // This allows toggling admin status on/off regardless of the count
                          // But for editing normal users, still enforce the limit
                          if (editingStaff && editingStaff.is_admin === true) {
                            return false;
                          }
                          
                          // For NEW staff or when granting admin to non-admin: disable if max reached
                          return adminCount >= maxAllowed;
                        })())}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span>Grant Admin Privileges</span>
                      {formData.institution_code && (() => {
                        const adminCount = staffMembers.filter(s => 
                          s.institution_code === formData.institution_code && 
                          s.is_admin && 
                          s.id !== editingStaff?.id &&
                          s.id_number !== '5274'
                        ).length;
                        
                        // For display purposes only: show the effective limit including Admin 5274
                        const isPostedHere = currentUser?.posting_institution === formData.institution_code;
                        // Max total admins:
                        // - If 5274 posted here: 2 locals + 5274 = 3 total
                        // - If 5274 NOT posted here: 2 locals = 2 total
                        const displayMaxAllowed = isPostedHere ? 3 : 2;
                        
                        // Calculate total for display: other admins + Admin 5274 (if posted here) + current edit if becoming/remaining admin
                        let totalCount = adminCount;
                        if (isPostedHere) {
                          totalCount += 1; // Count Admin 5274
                        }
                        if (formData.is_admin === true) {
                          // Person is currently set as admin (checkbox checked) - count them
                          totalCount += 1;
                        }
                        
                        if (totalCount >= displayMaxAllowed) {
                          return <span className="text-xs text-red-600 ml-2">(Max {displayMaxAllowed} admin{displayMaxAllowed > 1 ? 's' : ''} reached for {formData.institution_code})</span>;
                        } else if (totalCount > 0) {
                          return <span className="text-xs text-orange-600 ml-2">(Max {totalCount}/{displayMaxAllowed} admin{displayMaxAllowed > 1 ? 's' : ''})</span>;
                        }
                        return null;
                      })()}
                    </label>
                    {adminPrivilegeError && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        {adminPrivilegeError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={resetForm}
                  disabled={!isAdminAuthenticated}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isAdminAuthenticated || isSaving}
                  className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <h3 className="text-lg font-semibold text-gray-900">Confirm Action</h3>
              </div>
              <p className="text-gray-700 mb-6">{confirmationMessage}</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelConfirmation}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  {isSaving ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nickname Editor Modal */}
        {showNicknameEditor && editingNicknameFor && (
          <NicknameEditorModal
            isOpen={showNicknameEditor}
            onClose={() => {
              setShowNicknameEditor(false);
              setEditingNicknameFor(null);
            }}
            staffMember={editingNicknameFor}
            onNicknameUpdated={() => {
              loadStaffMembers();
            }}
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};