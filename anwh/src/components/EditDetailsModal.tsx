import React from 'react';
import { createPortal } from 'react-dom';
import { X, Edit, Calendar, User, Clock } from 'lucide-react';
import { RosterEntry } from '../types/roster';
import { formatDisplayDate } from '../utils/rosterFilters';
import { parseNameChange } from '../utils/rosterHelpers';
import { formatDisplayNameForUI, formatChangeDescription } from '../utils/rosterDisplayName';
import { ScrollingText } from './ScrollingText';

interface EditDetailsModalProps {
  isOpen: boolean;
  entry: RosterEntry | null;
  onClose: () => void;
}

export const EditDetailsModal: React.FC<EditDetailsModalProps> = ({ isOpen, entry, onClose }) => {
  if (!isOpen || !entry) return null;

  const formatTimestamp = (timestamp: string) => {
    try {
      const [datePart, timePart] = timestamp.split(' ');
      const [day, month, year] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second || '0'));
      
      const formattedDate = `${day}-${month}-${year}`;
      const formattedTime = `${hour}h${minute}`;
      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      return timestamp;
    }
  };

  const nameInfo = parseNameChange(entry.change_description || '', entry.assigned_name);

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
        <div className="relative p-6 pb-4 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Edit className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            Edit Details
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{formatDisplayDate(entry.date)}</span>
          </div>
        </div>

        <div className="p-6">
          <div 
            className="space-y-4 max-h-96 overflow-y-auto select-none"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {/* Shift Type */}
            <div className="p-3 bg-gray-50 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
              <div className="text-sm font-medium text-gray-700 mb-1 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Shift Type</div>
              <ScrollingText 
                text={entry.shift_type}
                className="text-gray-900 font-semibold select-none"
              />
            </div>

            {/* Current Assignment */}
            <div className="p-3 bg-gray-50 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
              <div className="text-sm font-medium text-gray-700 mb-1 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Current Assignment</div>
              <ScrollingText 
                text={formatDisplayNameForUI(entry.assigned_name)}
                className="text-gray-900 font-semibold select-none"
              />
            </div>

            {/* Name Change Details */}
            {nameInfo.isNameChange && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div className="text-sm font-medium text-yellow-800 mb-2 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Name Change</div>
                <ScrollingText className="select-none">
                  <div className="flex items-center space-x-2 whitespace-nowrap select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                    <User className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-red-600 font-medium line-through select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatDisplayNameForUI(nameInfo.oldName || 'Unknown')}</span>
                    <span className="text-gray-500 select-none flex-shrink-0" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>→</span>
                    <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-green-600 font-medium select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatDisplayNameForUI(nameInfo.newName || entry.assigned_name)}</span>
                  </div>
                </ScrollingText>
              </div>
            )}

            {/* Change Description - Show only name changes */}
            {entry.change_description && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div className="text-sm font-medium text-blue-800 mb-1 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Change History</div>
                <ScrollingText 
                  text={(() => {
                    // Extract only name change entries from the log
                    const logEntries = entry.change_description.split('|').map(e => e.trim());
                    const nameChangeEntries = logEntries.filter(entry => 
                      entry.includes('Name changed from') && entry.includes(' to ')
                    );
                    
                    if (nameChangeEntries.length === 0) {
                      return formatChangeDescription(entry.change_description.replace(/\s*\(Original PDF: [^)]+\)/, ''));
                    }
                    
                    // Format: "Name changed from OLD to NEW" (no timestamps or editors)
                    return nameChangeEntries.map(entry => {
                      const match = entry.match(/Name changed from "([^"]+)" to "([^"]+)"/);
                      if (match) {
                        const [, oldName, newName] = match;
                        return `Name changed from ${formatDisplayNameForUI(oldName)} to ${formatDisplayNameForUI(newName)}`;
                      }
                      return entry;
                    }).join(' | ');
                  })()}
                  className="text-blue-700 text-sm"
                />
              </div>
            )}

            {/* Initial Assignment */}
            {nameInfo.isNameChange && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div className="text-sm font-medium text-amber-800 mb-2 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Initial Assignment</div>
                <ScrollingText className="select-none">
                  <div className="flex items-center space-x-2 whitespace-nowrap select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                    <User className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-amber-700 font-medium select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatDisplayNameForUI(nameInfo.oldName || '')}</span>
                  </div>
                </ScrollingText>
              </div>
            )}

            {/* Edit Information */}
            {entry.last_edited_by && entry.last_edited_by !== '5274' && !entry.last_edited_by.includes('(5274)') && !entry.last_edited_by.toLowerCase().includes('admin') && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div className="text-sm font-medium text-green-800 mb-2 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Last Modified</div>
                <div className="space-y-1 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                  <ScrollingText className="select-none">
                    <div className="flex items-center space-x-2 whitespace-nowrap select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                      <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-green-700 font-medium select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatDisplayNameForUI(entry.last_edited_by).split(',')[0].split(' ')[0]}</span>
                    </div>
                  </ScrollingText>
                  {entry.last_edited_at && (
                    <ScrollingText className="select-none">
                      <div className="flex items-center space-x-2 whitespace-nowrap select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                        <Clock className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-green-700 text-sm select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatTimestamp(entry.last_edited_at)}</span>
                      </div>
                    </ScrollingText>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use createPortal to render modal at document root level
  return createPortal(modalContent, document.body);
};