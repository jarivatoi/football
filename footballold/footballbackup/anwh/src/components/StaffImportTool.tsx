import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const staffData = [
  { code: 'B165', name: 'BHEKUR', title: 'MIT', salary: 49445, employeeId: 'B1604812300915', firstName: 'Yashdev', surname: 'BHEKUR', is_admin: false },
  { code: 'B196', name: 'BHOLLOORAM', title: 'MIT', salary: 48810, employeeId: 'B1911811805356', firstName: 'Sawan', surname: 'BHOLLOORAM', is_admin: false },
  { code: 'D28B', name: 'DHUNNY', title: 'MIT', salary: 30060, employeeId: 'D280487461277B', firstName: 'Leelarvind', surname: 'DHUNNY', is_admin: false },
  { code: 'D07D', name: 'DOMUN', title: 'SMIT', salary: 59300, employeeId: 'D070273400031D', firstName: 'Sheik Ahmad Shamir', surname: 'DOMUN', is_admin: false },
  { code: 'H301', name: 'FOKEERCHAND', title: 'MIT', salary: 37185, employeeId: 'H3003861200061', firstName: 'Needeema', surname: 'FOKEERCHAND', is_admin: false },
  { code: 'S069', name: 'GHOORAN', title: 'MIT', salary: 48810, employeeId: 'S0607814601039', firstName: 'Bibi Shafinaaz', surname: 'SAMTALLY-GHOORAN', is_admin: false },
  { code: 'H13D', name: 'HOSENBUX', title: 'MIT', salary: 48810, employeeId: 'H130381180129D', firstName: 'Zameer', surname: 'HOSENBUX', is_admin: false },
  { code: 'J149', name: 'JUMMUN', title: 'MIT', salary: 47510, employeeId: 'J1403792600909', firstName: 'Bibi Nawsheen', surname: 'JUMMUN', is_admin: false },
  { code: 'M17G', name: 'MAUDHOO', title: 'MIT', salary: 39470, employeeId: 'M170380260096G', firstName: 'Chandanee', surname: 'MAUDHOO', is_admin: false },
  { code: 'N28C', name: 'NARAYYA', title: 'MIT', salary: 39470, employeeId: 'N280881240162C', firstName: 'Viraj', surname: 'NARAYYA', is_admin: false },
  { code: 'P09A', name: 'PITTEA', title: 'SMIT', salary: 59300, employeeId: 'P091171190413A', firstName: 'Soubiraj', surname: 'PITTEA', is_admin: false },
  { code: 'R16G', name: 'RUNGADOO', title: 'SMIT', salary: 59300, employeeId: 'R210572400118G', firstName: 'Manee', surname: 'RUNGADOO', is_admin: false },
  { code: 'T16G', name: 'TEELUCK', title: 'SMIT', salary: 59300, employeeId: '', firstName: '', surname: 'TEELUCK', is_admin: false },
  { code: 'V160', name: 'VEERASAWMY', title: 'SMIT', salary: 59300, employeeId: 'V1604664204410', firstName: 'Goindah', surname: 'VEERASAWMY', is_admin: false }
];

const adminUser = {
  code: 'ADMIN',
  name: 'USER',
  title: 'ADMIN',
  salary: 0,
  employeeId: 'admin-5274',
  firstName: 'Admin',
  surname: 'USER',
  is_admin: true
};

export const StaffImportTool: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ success: 0, errors: 0 });

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const importStaff = async () => {
    setImporting(true);
    setLogs([]);
    setProgress({ success: 0, errors: 0 });

    addLog('🚀 Starting staff import...');
    addLog('⚠️  Note: Only updating id_number field, keeping existing UUID ids unchanged');
    addLog('🔐 Setting default passcode: 1234 for all staff');
    
    let successCount = 0;
    let errorCount = 0;
    const allStaff = [...staffData, adminUser];

    for (const staff of allStaff) {
      try {
        // Try to find existing staff by their current id_number (code)
        const { data: existingByCode, error: fetchError } = await supabase
          .from('staff_users')
          .select('*')
          .eq('id_number', staff.code)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (existingByCode) {
          // Found staff by id_number - update only the id_number to ensure it's correct
          addLog(`⚠️  Found: ${existingByCode.name} ${existingByCode.surname} (Current ID: ${existingByCode.id})`);
          
          const { error } = await supabase
            .from('staff_users')
            .update({
              id_number: staff.employeeId, // Use 14-digit employee ID
              surname: staff.surname.toUpperCase(),
              name: staff.firstName || staff.name.split(' ')[0],
              is_admin: staff.is_admin || false,
              passcode: '1234' // Default passcode
            })
            .eq('id', existingByCode.id); // Use the existing UUID

          if (error) throw error;
          addLog(`✅ Updated: id_number=${staff.employeeId}`);
          successCount++;
        } else {
          // No existing staff found with this code - create new record
          // Generate a new UUID for the id field
          const newId = crypto.randomUUID();
          
          const staffRecord = {
            id: newId,
            id_number: staff.employeeId, // Use 14-digit employee ID
            surname: staff.surname.toUpperCase(),
            name: staff.firstName || staff.name.split(' ')[0],
            is_admin: staff.is_admin || false,
            is_active: true,
            passcode: '1234' // Default passcode
          };

          addLog(`✨ Creating new: ${staffRecord.surname} (New ID: ${newId})`);
          
          const { error } = await supabase
            .from('staff_users')
            .insert(staffRecord);

          if (error) throw error;
          addLog(`✅ Created: id_number=${staff.employeeId}`);
          successCount++;
        }

        setProgress({ success: successCount, errors: errorCount });
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error: any) {
        addLog(`❌ Error processing ${staff.surname}: ${error.message}`);
        errorCount++;
        setProgress({ success: successCount, errors: errorCount });
      }
    }

    addLog('\n=================================');
    addLog('✅ Import Complete!');
    addLog(`Success: ${successCount} | Errors: ${errorCount}`);
    addLog('=================================');
    
    setImporting(false);
  };

  return (
    <div style={{ 
      padding: '20px', 
      background: '#f9fafb', 
      borderRadius: '8px',
      marginTop: '20px'
    }}>
      <h3 style={{ marginBottom: '12px', color: '#1f2937' }}>📋 Staff Data Import Tool</h3>
      <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
        This will import/update {staffData.length + 1} staff members with correct IDs
      </p>
      
      <button
        onClick={importStaff}
        disabled={importing}
        style={{
          padding: '12px 24px',
          background: importing ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: importing ? 'not-allowed' : 'pointer',
          opacity: importing ? 0.7 : 1,
          marginBottom: '16px'
        }}
      >
        {importing ? '⏳ Importing...' : '🚀 Start Import'}
      </button>

      {logs.length > 0 && (
        <div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(logs.join('\n'));
              alert('✅ Logs copied to clipboard!');
            }}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '12px',
              fontSize: '13px'
            }}
          >
            📋 Copy Logs to Clipboard
          </button>
          
          <div style={{
            background: '#1f2937',
            color: '#10b981',
            padding: '16px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            cursor: 'text',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {progress.success > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#d1fae5',
          color: '#059669',
          borderRadius: '8px',
          textAlign: 'center',
          fontWeight: 600
        }}>
          ✅ Successfully processed {progress.success} staff member(s)
          {progress.errors > 0 && ` (${progress.errors} errors)`}
        </div>
      )}
    </div>
  );
};
