import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserSession } from '../utils/indexedDB';

interface NicknameEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: {
    id: string;
    surname: string;
    name: string;
    nickname?: string | null;
    institution_code?: string;
  };
  onNicknameUpdated: () => void;
}

export const NicknameEditorModal: React.FC<NicknameEditorModalProps> = ({
  isOpen,
  onClose,
  staffMember,
  onNicknameUpdated
}) => {
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentUser();
      setNickname(staffMember.nickname || '');
      setError('');
    }
  }, [isOpen, staffMember]);

  useEffect(() => {
    checkEditPermission();
  }, [currentUser, staffMember]);

  const loadCurrentUser = async () => {
    try {
      const user = await getUserSession();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const checkEditPermission = () => {
    if (!currentUser) {
      setCanEdit(false);
      return;
    }

    // Master admin (5274) can edit anyone
    if (currentUser.idNumber === '5274') {
      setCanEdit(true);
      return;
    }

    // Admin from same institution can edit
    if (currentUser.isAdmin && currentUser.institutionCode === staffMember.institution_code) {
      setCanEdit(true);
      return;
    }

    // User can edit their own nickname
    if (currentUser.userId === staffMember.id) {
      setCanEdit(true);
      return;
    }

    setCanEdit(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('staff_users')
        .update({ nickname: nickname.trim() || null })
        .eq('id', staffMember.id);

      if (updateError) throw updateError;

      onNicknameUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating nickname:', err);
      setError('Failed to update nickname. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            ✏️ Edit Nickname
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Staff Info */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Staff:</strong> {staffMember.surname}, {staffMember.name}
            </p>
          </div>

          {/* Permission Notice */}
          {!canEdit && (
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                You don't have permission to edit this nickname. Only the staff member themselves, their institution admin, or master admin can edit.
              </p>
            </div>
          )}

          {/* Nickname Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nickname (for roster display)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={!canEdit || isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter nickname (optional)"
              maxLength={50}
            />
            <p className="mt-1 text-xs text-gray-500">
              This name will be shown in the roster view. Leave empty to use full name.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit || isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Nickname</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
