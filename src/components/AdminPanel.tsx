import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { StaffManagementModal } from './UserManagementModal'
import { RegistrationApprovalModal } from './RegistrationApprovalModal'
import { Notification } from './Notification'
import { Users, Wrench, CheckCircle, LogOut, ArrowLeft } from 'lucide-react'
import { getUserSession, removeUserSession } from '../utils/userSessionDB'

interface AdminPanelProps {
  onBack?: () => void;
  onLogout?: () => void;
}

// Helper function to format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'never'
  
  try {
    const date = new Date(dateString)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const dayName = days[date.getDay()]
    const day = date.getDate().toString().padStart(2, '0')
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${dayName} ${day}-${month}-${year} ${hours}:${minutes}`
  } catch {
    return dateString
  }
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack, onLogout }) => {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Quick Actions state
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showRegistrationApproval, setShowRegistrationApproval] = useState(false)
  const [isMaintenanceEnabled, setIsMaintenanceEnabled] = useState(false)
  const [confirmMaintenanceModal, setConfirmMaintenanceModal] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ userId: string; userName: string } | null>(null)
  
  // Sort state for User Directory
  const [sortBy, setSortBy] = useState<'last_login'>('last_login')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getUserSession();
      
      if (!session) {
        return;
      }
      
      // Fetch current user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.userId)
        .single();
      
      if (userError) {
        setError('Failed to load user data');
        return;
      }
      
      // Fetch all users
      const { data, error } = await supabase
        .from('users')
        .select('id, surname, name, id_number, last_login, is_admin, is_active')
        .order('last_login', { ascending: false });
      
      if (error) throw error
      if (data) setUsers(data)
      
    } catch (err: any) {
      setError(err.message || 'Failed to load admin panel data')
    } finally {
      setLoading(false)
    }
  }

  const loadMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('metadata')
        .select('value')
        .eq('key', 'maintenanceMode')
        .single();
      
      if (error) {
        // If no metadata record exists, default to false
        if (error.code === 'PGRST116') {
          setIsMaintenanceEnabled(false);
        } else {
          console.error('Error loading maintenance mode:', error);
        }
      } else {
        setIsMaintenanceEnabled(data?.value === true);
      }
    } catch (err) {
      console.error('Failed to load maintenance mode:', err);
    }
  }

  const handleToggleMaintenanceMode = async () => {
    setConfirmMaintenanceModal(true)
  }

  const handleConfirmMaintenanceToggle = async () => {
    setConfirmMaintenanceModal(false)
    
    try {
      const { error } = await supabase
        .from('metadata')
        .upsert({ key: 'maintenanceMode', value: !isMaintenanceEnabled }, { onConflict: 'key' })
      
      if (error) throw error
      
      // Update local state
      setIsMaintenanceEnabled(!isMaintenanceEnabled)
      setNotification({
        message: `Maintenance Mode ${!isMaintenanceEnabled ? 'ENABLED' : 'DISABLED'}!`,
        type: 'success'
      })
    } catch (err: any) {
      console.error('Failed to toggle maintenance mode:', err)
      setNotification({
        message: err.message || 'Failed to toggle maintenance mode',
        type: 'error'
      })
    }
  }

  const handleCancelMaintenanceToggle = () => {
    setConfirmMaintenanceModal(false)
  }

  useEffect(() => { 
    fetchData();
    loadMaintenanceMode();
  }, [])
    
  // Listen for session changes
  useEffect(() => {
    const handleSessionChange = async () => {
      await fetchData();
    };
  
    window.addEventListener('sessionChanged', handleSessionChange);
    return () => window.removeEventListener('sessionChanged', handleSessionChange);
  }, []);
    
  // Subscribe to realtime changes for maintenance mode
  useEffect(() => {
    const channel = supabase
      .channel('maintenance-mode-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metadata',
          filter: 'key=eq.maintenanceMode'
        },
        (payload: any) => {
          setIsMaintenanceEnabled(payload.new?.value === true);
          console.log('🔧 Maintenance mode changed:', payload.new?.value);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sort users based on selected criteria
  const sortedUsers = useMemo(() => {
    let filtered = users.filter(u => u.id_number !== '5274');
    
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'last_login':
          const aHasLogin = !!a.last_login;
          const bHasLogin = !!b.last_login;
          
          if (aHasLogin && !bHasLogin) return -1;
          if (!aHasLogin && bHasLogin) return 1;
          
          if (!aHasLogin && !bHasLogin) {
            return (a.surname || '').localeCompare(b.surname || '');
          }
          
          comparison = new Date(a.last_login).getTime() - new Date(b.last_login).getTime();
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [users, sortBy, sortOrder]);

  const toggleUserAccess = async (userId: string, currentActiveStatus: boolean) => {
    try {
      await supabase.from('users').update({ is_active: !currentActiveStatus }).eq('id', userId)
      fetchData()
    } catch (error) {
      setNotification({ message: 'Error updating user access', type: 'error' })
    }
  }

    const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteModal({ userId, userName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    
    try {
      await supabase.from('users').delete().eq('id', deleteModal.userId);
      fetchData();
      setNotification({ message: `${deleteModal.userName} deleted successfully`, type: 'success' });
      setDeleteModal(null);
    } catch (error) {
      setNotification({ message: 'Error deleting user', type: 'error' });
      setDeleteModal(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal(null);
  };

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      {/* Admin Panel Title - Top */}
      <h2 style={{ 
        margin: '0 0 16px 0',
        fontSize: 24,
        fontWeight: 700,
        textAlign: 'center'
      }}>
        Admin Panel
      </h2>
      
      {/* Back, Maintenance, Logout - In one line */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        height: 40
      }}>
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              height: 40
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        
        {/* Maintenance Mode Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: isMaintenanceEnabled ? '#fee2e2' : '#dcfce7',
          fontSize: '14px',
          fontWeight: 600,
          height: 40
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isMaintenanceEnabled ? '#dc2626' : '#16a34a',
            animation: 'pulse 2s infinite'
          }} />
          <span style={{ color: isMaintenanceEnabled ? '#991b1b' : '#166534' }}>
            Maintenance: {isMaintenanceEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
        
        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              height: 40
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        )}
      </div>
      
      {/* Add pulse animation styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
      `}</style>
      
      {error && (
        <div style={{ padding: 12, backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      
      {/* Quick Actions Button */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Wrench className="w-5 h-5" />
          Quick Actions
        </button>
        
        {showQuickActions && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 8,
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 100
          }}>
            {/* 1. User Management */}
            <button
              onClick={() => {
                setShowUserManagement(true)
                setShowQuickActions(false)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: 'white',
                border: 'none',
                borderBottom: '1px solid #f3f4f6',
                color: '#1f2937',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <Users className="w-5 h-5" />
              User Management
            </button>
            
            {/* 2. Registration Approval */}
            <button
              onClick={() => {
                setShowRegistrationApproval(true)
                setShowQuickActions(false)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: 'white',
                border: 'none',
                borderBottom: '1px solid #f3f4f6',
                color: '#1f2937',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <CheckCircle className="w-5 h-5" />
              Registration Approval
            </button>
            
            {/* 3. Maintenance Mode */}
            <button
              onClick={() => {
                handleToggleMaintenanceMode()
                setShowQuickActions(false)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: 'white',
                border: 'none',
                color: isMaintenanceEnabled ? '#dc2626' : '#ea580c',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 500
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fff7ed'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <Wrench className="w-5 h-5" />
              {isMaintenanceEnabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode (Currently OFF)'}
            </button>
          </div>
        )}
      </div>
            
      {/* User Directory - Hidden when Quick Actions is open */}
      {!showQuickActions && (
      <div style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {/* Centered Title */}
        <h3 style={{ 
          marginBottom: 16,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700
        }}>
          <strong>User Directory</strong> ({sortedUsers.length} users)
        </h3>
        
        {/* Centered Filter */}
        <div style={{ 
          marginBottom: 16, 
          display: 'flex', 
          gap: 8,
          justifyContent: 'center'
        }}>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy as any);
                  setSortOrder(newSortOrder as any);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
              >
                <option value="last_login-desc">Last Login (Newest)</option>
                <option value="last_login-asc">Last Login (Oldest)</option>
              </select>
            </div>
            
            {loading ? (
              <div style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : (
            <div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sortedUsers.map((user) => (
                <li
                  key={user.id}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>
                      {user.surname} {user.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                      ID: {user.id_number}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      Last Login: {formatDate(user.last_login)}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => toggleUserAccess(user.id, user.is_active)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: user.is_active ? '#ef4444' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteClick(user.id, `${user.name} ${user.surname}`)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}
      
      {/* Modals */}
      {showUserManagement && (
        <StaffManagementModal
          isOpen={showUserManagement}
          onClose={() => setShowUserManagement(false)}
          isAdminAuthenticated={true}
          adminName="Admin"
        />
      )}
      
      {showRegistrationApproval && (
        <RegistrationApprovalModal
          isOpen={showRegistrationApproval}
          onClose={() => setShowRegistrationApproval(false)}
          adminUser={{ idNumber: '5274', name: 'Admin' } as any}
        />
      )}
      
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={handleCancelDelete}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700 }}>
              Confirm Delete
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 16, color: '#374151' }}>
              Are you sure you want to delete <strong>{deleteModal.userName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCancelDelete}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Maintenance Mode Confirmation Modal */}
      {confirmMaintenanceModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelMaintenanceToggle()
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%'
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>
              Toggle Maintenance Mode?
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>
                {isMaintenanceEnabled
                  ? 'This will DISABLE maintenance mode and make the app visible to all users.'
                  : 'This will ENABLE maintenance mode and show a maintenance screen to all users.'
                }
              </p>
              <p style={{
                fontSize: '12px',
                color: isMaintenanceEnabled ? '#dc2626' : '#16a34a',
                marginTop: '12px',
                fontWeight: 500
              }}>
                Current Status: <strong>{isMaintenanceEnabled ? '🔴 ENABLED' : '🟢 DISABLED (OFF)'}</strong>
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={handleCancelMaintenanceToggle}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMaintenanceToggle}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: isMaintenanceEnabled ? '#dc2626' : '#ea580c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isMaintenanceEnabled ? '#b91c1c' : '#c2410c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isMaintenanceEnabled ? '#dc2626' : '#ea580c'}
              >
                {isMaintenanceEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
