import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { StaffMember } from '../utils/staffApi';
import { authCodes, AuthCode, updateAuthCodes } from '../utils/rosterAuth';

export const useStaffData = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const isMountedRef = useRef(true);

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Convert StaffMember to AuthCode format
  const convertToAuthCode = (staff: StaffMember): AuthCode => ({
    code: staff.code,
    name: staff.name,
    title: staff.title,
    salary: staff.salary,
    employeeId: staff.employee_id,
    firstName: staff.first_name,
    surname: staff.surname
  });

  // Update local auth codes when staff data changes
  const updateLocalAuthCodes = useCallback(async (staffList: StaffMember[]) => {
    try {
      const authCodesList = staffList.map(convertToAuthCode);
      
      // Update the rosterAuth module
      await updateAuthCodes(authCodesList);
    } catch (error) {
      // Error handled silently
    }
  }, []);

  const loadStaffMembers = useCallback(async () => {
    if (!supabase) {
      // Convert local auth codes to staff member format
      const localStaffMembers: StaffMember[] = authCodes
        .filter((auth: AuthCode) => auth.name !== 'ADMIN') // Exclude ADMIN from staff list
        .map((auth: AuthCode) => ({
          id: auth.code, // Use code as ID for local data
          code: auth.code,
          name: auth.name,
          title: auth.title || 'MIT',
          salary: auth.salary || 0,
          employee_id: auth.employeeId || '',
          first_name: auth.firstName || '',
          surname: auth.surname || auth.name,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_updated_by: 'LOCAL'
        }));
      
      console.log('📋 Local staff members:', localStaffMembers.length);
      
      if (isMountedRef.current) {
        setStaffMembers(localStaffMembers);
        setError('Using local staff data - database not available');
        setLoading(false);
      }
      return;
    }

    try {
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('staff_members')
        .select('*')
        .order('surname', { ascending: true });

      if (fetchError) {
        throw new Error(`Database error: ${fetchError.message}`);
      }
      
      if (isMountedRef.current) {
        setStaffMembers(data || []);
        
        // Update local auth codes with server data
        if (data && data.length > 0) {
          await updateLocalAuthCodes(data);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load staff members';
        setError(errorMessage);
        
        // Fallback to local auth codes on error
        const localStaffMembers: StaffMember[] = authCodes
          .filter((auth: AuthCode) => auth.name !== 'ADMIN')
          .map((auth: AuthCode) => ({
            id: auth.code,
            code: auth.code,
            name: auth.name,
            title: auth.title || 'MIT',
            salary: auth.salary || 0,
            employee_id: auth.employeeId || '',
            first_name: auth.firstName || '',
            surname: auth.surname || auth.name,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_updated_by: 'LOCAL'
          }));
        
        setStaffMembers(localStaffMembers);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [updateLocalAuthCodes]);

  // Set up real-time subscription
  useEffect(() => {
    if (!supabase) {
      setRealtimeStatus('error');
      return;
    }

    setRealtimeStatus('connecting');

    const channel = supabase
      .channel('staff_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_members'
        },
        async (payload: any) => {
          try {
            if (!isMountedRef.current) {
              return;
            }

            // Handle different types of changes
            if (payload.eventType === 'INSERT' && payload.new) {
              const newStaff = payload.new as StaffMember;
              setStaffMembers((prev: StaffMember[]) => {
                const exists = prev.some((staff: StaffMember) => staff.id === newStaff.id);
                if (!exists) {
                  const updated = [...prev, newStaff].sort((a: StaffMember, b: StaffMember) => a.surname.localeCompare(b.surname));
                  updateLocalAuthCodes(updated);
                  return updated;
                }
                return prev;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedStaff = payload.new as StaffMember;
              setStaffMembers((prev: StaffMember[]) => {
                let updated;
                // Since we're doing hard deletes now, we don't need to check is_active
                const exists = prev.some((staff: StaffMember) => staff.id === updatedStaff.id);
                if (exists) {
                  // Update existing staff
                  updated = prev.map((staff: StaffMember) => 
                    staff.id === updatedStaff.id ? updatedStaff : staff
                  );
                } else {
                  // Add new staff
                  updated = [...prev, updatedStaff];
                }
                // Sort by surname
                updated = updated.sort((a: StaffMember, b: StaffMember) => a.surname.localeCompare(b.surname));
                updateLocalAuthCodes(updated);
                return updated;
              });
            } else if (payload.eventType === 'DELETE' && payload.old) {
              const deletedStaff = payload.old as StaffMember;
              setStaffMembers((prev: StaffMember[]) => {
                const updated = prev.filter((staff: StaffMember) => staff.id !== deletedStaff.id);
                updateLocalAuthCodes(updated);
                return updated;
              });
            }

            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
              detail: payload
            }));

          } catch (error) {
            // Error handled silently
          }
        }
      )
      .subscribe((status: any, err: any) => {
        if (isMountedRef.current) {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
          } else if (status === 'CHANNEL_ERROR') {
            setRealtimeStatus('error');
          } else if (status === 'TIMED_OUT') {
            setRealtimeStatus('error');
            // Try to reconnect after a delay
            setTimeout(() => {
              if (isMountedRef.current) {
                setRealtimeStatus('connecting');
              }
            }, 5000);
          } else if (status === 'CLOSED') {
            setRealtimeStatus('disconnected');
          }
        }
      });

    // Initial load
    loadStaffMembers();

    // Cleanup
    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadStaffMembers, updateLocalAuthCodes]);

  return {
    staffMembers,
    loading,
    error,
    realtimeStatus,
    loadStaffMembers
  };
};