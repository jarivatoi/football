import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit, Trash2, MapPin, Building, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserSession } from '../utils/indexedDB';

interface AttachedCenter {
  id: string;
  institution_code: string;
  marker: string;
  center_name: string;
  created_at: string;
}

interface AttachedCentersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AttachedCentersModal: React.FC<AttachedCentersModalProps> = ({
  isOpen,
  onClose
}) => {
  const [centers, setCenters] = useState<AttachedCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMarker, setEditMarker] = useState('');
  const [editCenterName, setEditCenterName] = useState('');
  const [newMarker, setNewMarker] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [userInstitution, setUserInstitution] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFetchingInstitution, setIsFetchingInstitution] = useState(true);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Alert modal state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'error' | 'warning' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  // Fetch current user's institution and admin status
  useEffect(() => {
    const fetchUserInstitution = async () => {
      try {
        const session = await getUserSession();
        if (session) {
          setIsAdmin(!!session.isAdmin);
          
          // Fetch user details from Supabase to get institution info
          const { data: userData, error } = await supabase
            .from('staff_users')
            .select('institution_code, posting_institution')
            .eq('id_number', session.idNumber)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching user institution:', error);
            setUserInstitution(null);
          } else {
            // For institution filtering:
            // Use institution_code for all admins (including Admin 5274)
            // This ensures attached centers are filtered by their own institution
            const institution = userData?.institution_code || userData?.posting_institution;
            
            setUserInstitution(institution || null);
          }
        } else {
          console.warn('⚠️ No session found in AttachedCentersModal');
          setUserInstitution(null);
        }
      } catch (err) {
        console.error('Failed to fetch user institution:', err);
        setUserInstitution(null);
      } finally {
        setIsFetchingInstitution(false);
      }
    };
    
    fetchUserInstitution();
  }, []);

  // Fetch attached centers for user's institution
  useEffect(() => {
    if (isOpen && userInstitution) {
      fetchCenters();
    }
  }, [isOpen, userInstitution]);

  const fetchCenters = async () => {
    if (!userInstitution) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attached_centers')
        .select('*')
        .eq('institution_code', userInstitution)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setCenters(data);
    } catch (error) {
      console.error('Error fetching attached centers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCenter = async () => {
    if (!userInstitution) {
      setAlertModal({
        isOpen: true,
        title: 'Institution Error',
        message: 'Unable to determine your institution. Please refresh the page and try again.',
        type: 'error'
      });
      return;
    }
    
    if (!newMarker.trim() || !newCenterName.trim()) {
      setAlertModal({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please fill in both fields',
        type: 'warning'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('attached_centers')
        .insert({
          institution_code: userInstitution,
          marker: newMarker.trim(),
          center_name: newCenterName.trim()
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          setAlertModal({
            isOpen: true,
            title: 'Duplicate Marker',
            message: `Marker "${newMarker}" already exists for this institution`,
            type: 'warning'
          });
        } else {
          throw error;
        }
        return;
      }

      setNewMarker('');
      setNewCenterName('');
      await fetchCenters();
    } catch (error) {
      console.error('Error adding center:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to add center: ' + (error as any).message,
        type: 'error'
      });
    }
  };

  const handleUpdateCenter = async (id: string, updates: Partial<AttachedCenter>) => {
    try {
      const { error } = await supabase
        .from('attached_centers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchCenters();
      setEditingId(null);
    } catch (error) {
      console.error('Error updating center:', error);
      setAlertModal({
        isOpen: true,
        title: 'Update Failed',
        message: 'Failed to update center',
        type: 'error'
      });
    }
  };
  
  const startEditing = (center: AttachedCenter) => {
    setEditingId(center.id);
    setEditMarker(center.marker);
    setEditCenterName(center.center_name);
  };

  const handleDeleteCenter = async (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Center',
      message: 'Are you sure you want to delete this attached center?',
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('attached_centers')
            .delete()
            .eq('id', id);

          if (error) throw error;
          await fetchCenters();
        } catch (error) {
          console.error('Error deleting center:', error);
          setAlertModal({
            isOpen: true,
            title: 'Delete Failed',
            message: 'Failed to delete center',
            type: 'error'
          });
        }
      }
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative pb-4 border-b border-gray-200 flex-shrink-0 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Building className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Attached Centers</h3>
          </div>
          
          <p className="text-sm text-gray-600 ml-15">
            Manage satellite centers for institution: <strong>{isFetchingInstitution ? 'Loading...' : (userInstitution || 'Unknown')}</strong>
          </p>
          
          {isFetchingInstitution && (
            <div className="mt-4 text-center text-sm text-indigo-600">
              Loading your institution details...
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add New Center Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add New Attached Center
            </h4>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marker (*)
                </label>
                <input
                  type="text"
                  value={newMarker}
                  onChange={(e) => setNewMarker(e.target.value)}
                  placeholder="*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={5}
                />
                <p className="text-xs text-gray-500 mt-1">e.g., *, **, ***</p>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Center Name
                </label>
                <input
                  type="text"
                  value={newCenterName}
                  onChange={(e) => setNewCenterName(e.target.value)}
                  placeholder="ENT Hospital"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Full name of the center</p>
              </div>
            </div>
            
            <button
              onClick={handleAddCenter}
              disabled={isFetchingInstitution || !userInstitution || !newMarker.trim() || !newCenterName.trim()}
              className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isFetchingInstitution ? 'Loading...' : 'Add Center'}</span>
            </button>
          </div>

          {/* Existing Centers List */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              Current Attached Centers
            </h4>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : centers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No attached centers configured yet
              </div>
            ) : (
              <div className="space-y-2">
                {centers.map((center) => (
                  <div
                    key={center.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {editingId === center.id ? (
                      // Edit mode
                      <div className="flex-1 flex items-center space-x-3">
                        <input
                          type="text"
                          value={editMarker}
                          onChange={(e) => setEditMarker(e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                          maxLength={5}
                        />
                        <input
                          type="text"
                          value={editCenterName}
                          onChange={(e) => setEditCenterName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => {
                            handleUpdateCenter(center.id, {
                              marker: editMarker,
                              center_name: editCenterName
                            });
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-center space-x-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                            {center.marker}
                          </span>
                          <span className="font-medium text-gray-900">{center.center_name}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEditing(center)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCenter(center.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-800 mb-2">How it works:</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Add markers (*, **, ***) for Centers</li>
              <li>• Staff posted to these Centers will have the marker prefix in roster</li>
              <li>• The Center name appears in remarks field for billing</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]"
          onClick={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                confirmationModal.type === 'danger' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                {confirmationModal.type === 'danger' ? (
                  <Trash2 className="w-6 h-6 text-red-600" />
                ) : (
                  <Building className="w-6 h-6 text-yellow-600" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {confirmationModal.title}
              </h3>
              <p className="text-gray-600 mb-6">
                {confirmationModal.message}
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setConfirmationModal({ ...confirmationModal, isOpen: false });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmationModal.onConfirm();
                    setConfirmationModal({ ...confirmationModal, isOpen: false });
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    confirmationModal.type === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]"
          onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                alertModal.type === 'error' ? 'bg-red-100' :
                alertModal.type === 'success' ? 'bg-green-100' :
                alertModal.type === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
                {alertModal.type === 'error' ? (
                  <X className="w-6 h-6 text-red-600" />
                ) : alertModal.type === 'success' ? (
                  <Save className="w-6 h-6 text-green-600" />
                ) : (
                  <Building className="w-6 h-6 text-blue-600" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {alertModal.title}
              </h3>
              <p className="text-gray-600 mb-6">
                {alertModal.message}
              </p>
              
              <button
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AttachedCentersModal;
