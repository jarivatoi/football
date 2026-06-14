import { Shift, ShiftCombination } from './types';

export const SHIFTS: Shift[] = [
  { 
    id: '12-10', 
    label: 'Saturday Regular', 
    time: '12-10', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    displayColor: 'text-gray-800'
  },
  { 
    id: '9-4', 
    label: 'Sunday/Public Holiday/Special', 
    time: '9-4', 
    color: 'bg-red-100 text-red-800 border-red-200',
    displayColor: 'text-red-600'
  },
  { 
    id: '4-10', 
    label: 'Evening Shift', 
    time: '4-10', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    displayColor: 'text-blue-600'
  },
  { 
    id: 'N', 
    label: 'Night Duty', 
    time: 'N', 
    color: 'bg-green-100 text-green-800 border-green-200',
    displayColor: 'text-green-600'
  }
];

export const DEFAULT_SHIFT_COMBINATIONS: ShiftCombination[] = [
  { id: '9-4', combination: '9-4', hours: 6.5 },
  { id: '9-4+4-10', combination: '9-4 + 4-10', hours: 12 },
  { id: '9-4+N', combination: '9-4 + N', hours: 19 },
  { id: '9-4+4-10+N', combination: '9-4 + 4-10 + N', hours: 24.5 },
  { id: 'AM+12-10', combination: 'AM + 12-10', hours: 9 },
  { id: 'AM+12-10+N', combination: 'AM + 12-10 + N', hours: 21.5 },
  { id: '12-10', combination: '12-10', hours: 9.5 },
  { id: '12-10+N', combination: '12-10 + N', hours: 22 },
  { id: '4-10', combination: '4-10', hours: 5.5 },
  { id: '4-10+N', combination: '4-10 + N', hours: 18 },
  { id: 'N', combination: 'N', hours: 12.5 }
];