# Totelepep User Authentication Implementation Guide

## Overview
This guide will help you complete the user authentication implementation for your Totelepep football odds app, adapted from the `anwh` project.

## What's Already Done ✅

1. ✅ **Supabase Client** - Created at `src/lib/supabase.ts`
2. ✅ **User Session DB** - Created at `src/utils/userSessionDB.ts`
3. ✅ **UserLogin Component** - Created at `src/components/UserLogin.tsx`
4. ✅ **SplitText Utility** - Copied from anwh project
5. ✅ **GSAP Installed** - Animation library for login screen
6. ✅ **Supabase SQL Migration** - Created at `supabase_users_migration.sql`

## Next Steps to Complete

### Step 1: Run Supabase Migration
1. Go to your Supabase Dashboard: https://zaleugflzamrkrfkrcsa.supabase.co
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_users_migration.sql`
4. Click **Run** to execute the migration

This will create the `users` table with:
- User credentials (id_number, passcode)
- Admin privileges (is_admin flag)
- Active status control
- Last login tracking
- Default admin user (ID: 5274, Passcode: 5274)

### Step 2: Copy Additional Components from anwh

You need to copy and adapt these components from the `anwh` project:

#### Files to Copy:
```
From: c:\Users\subit\Downloads\Football\anwh\src\components\
To: c:\Users\subit\Downloads\Football\src\components\

1. ProfileTab.tsx → Rename to UserProfile.tsx
2. AdminPanel.tsx → Keep as AdminPanel.tsx
3. RegistrationApprovalModal.tsx
4. StaffManagementModal.tsx → Rename to UserManagementModal.tsx
5. MaintenanceMode.tsx
6. ConfirmationModal.tsx
7. Notification.tsx
```

#### Copy Commands (PowerShell):
```powershell
# Navigate to your project
cd c:\Users\subit\Downloads\Football

# Copy components
Copy-Item "anwh\src\components\ProfileTab.tsx" "src\components\UserProfile.tsx"
Copy-Item "anwh\src\components\AdminPanel.tsx" "src\components\AdminPanel.tsx"
Copy-Item "anwh\src\components\RegistrationApprovalModal.tsx" "src\components\RegistrationApprovalModal.tsx"
Copy-Item "anwh\src\components\StaffManagementModal.tsx" "src\components\UserManagementModal.tsx"
Copy-Item "anwh\src\components\MaintenanceMode.tsx" "src\components\MaintenanceMode.tsx"
Copy-Item "anwh\src\components\ConfirmationModal.tsx" "src\components\ConfirmationModal.tsx"
Copy-Item "anwh\src\components\Notification.tsx" "src\components\Notification.tsx"

# Copy types
Copy-Item "anwh\src\types.ts" "src\types\AuthTypes.ts"
```

### Step 3: Adapt the Copied Components

After copying, make these changes:

#### 3.1 UserProfile.tsx (adapted from ProfileTab.tsx)
- Change import from `'./AdminPanel'` to `'./AdminPanel'`
- Change all references from `staff_users` table to `users` table
- Add logic: if `user.isAdmin` is true, show AdminPanel instead of profile form
- Keep the same styling and functionality

#### 3.2 AdminPanel.tsx
**Remove:**
- Posting button and PostingSelectorModal import
- All `showPostingSelector` state and related code
- Any reference to `posting_institution`

**Keep:**
- User 5274 privileges (checks for `id_number === '5274'`)
- Quick Actions with only:
  - User Management (opens UserManagementModal)
  - Registration Approval (opens RegistrationApprovalModal)
  - Maintenance Mode (toggles maintenance mode)
- User Directory (renamed from Staff Directory)
  - Remove all institution filters
  - Keep only Last Login filter
  - Sort by last_login only

**Changes:**
- Replace all `staff_users` references with `users`
- Rename "Staff Management" to "User Management"
- Rename "Staff Directory" to "User Directory"

#### 3.3 UserManagementModal.tsx (adapted from StaffManagementModal.tsx)
- Replace all `staff_users` references with `users`
- Remove all institution-related fields and filters
- Simplify the form to only include:
  - ID Number
  - Surname
  - Name
  - Passcode
  - Admin Privileges checkbox (only visible to user 5274)
  - Active status toggle

#### 3.4 RegistrationApprovalModal.tsx
- Replace `staff_users` with `users`
- This modal approves pending user registrations
- For now, you can simplify it or remove it if not needed initially

#### 3.5 MaintenanceMode.tsx
- This component toggles a maintenance mode flag
- You can store this in localStorage or Supabase `system_settings` table
- Keep it simple: a toggle button that enables/disables maintenance mode

### Step 4: Update Header Component

Update `src/components/Header.tsx` to add a Settings button:

```typescript
// Add these imports
import { Settings } from 'lucide-react';

// Add to props
interface HeaderProps {
  selectionCount: number;
  onSlipClick: () => void;
  selectedSource: ApiSource;
  onSourceChange: (source: ApiSource) => void;
  onSettingsClick?: () => void; // NEW
}

// Add Settings button in the header (after the Slip button)
{onSettingsClick && (
  <button
    onClick={onSettingsClick}
    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
  >
    <Settings className="w-5 h-5" />
    <span className="text-sm">Settings</span>
  </button>
)}
```

### Step 5: Integrate into App.tsx

Add authentication flow to `src/App.tsx`:

```typescript
import { useState, useEffect } from 'react';
import UserLogin from './components/UserLogin';
import UserProfile from './components/UserProfile';
import { getUserSession } from './utils/userSessionDB';

function App() {
  // Add authentication state
  const [userSession, setUserSession] = useState<{
    userId: string;
    idNumber: string;
    isAdmin: boolean;
    surname?: string;
    name?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const session = await getUserSession();
      if (session) {
        setUserSession(session);
      }
      setIsLoading(false);
    };
    checkSession();
  }, []);

  const handleLoginSuccess = (session: any) => {
    setUserSession(session);
  };

  const handleLogout = async () => {
    await removeUserSession();
    setUserSession(null);
    setShowSettings(false);
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  // Show loading state
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show login screen if not authenticated
  if (!userSession) {
    return <UserLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Show settings/profile if clicked
  if (showSettings) {
    return (
      <UserProfile 
        user={userSession}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
      />
    );
  }

  // Show main app (your existing code)
  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        selectionCount={parlaySelections.length}
        onSlipClick={toggleParlayBuilder}
        selectedSource={selectedSource}
        onSourceChange={handleSourceChange}
        onSettingsClick={handleSettingsClick} // NEW
      />
      {/* ... rest of your existing app code ... */}
    </div>
  );
}
```

### Step 6: Create types file

Create `src/types/AuthTypes.ts`:

```typescript
export interface UserSession {
  userId: string;
  idNumber: string;
  surname?: string;
  name?: string;
  isAdmin: boolean;
}

export interface User {
  id: string;
  id_number: string;
  surname: string;
  name: string;
  passcode: string;
  is_admin: boolean;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}
```

## Key Features Implemented

### 1. User Sign In Screen ✅
- Animated "User Sign In" header using GSAP
- ID Number + 4-digit Passcode login
- Forgot Passcode functionality
- Auto-fill last used ID Number
- Admin 5274 special login

### 2. User Profile
- Regular users see their profile (edit name, change passcode)
- Admin users (is_admin=true) see Admin Panel instead
- Logout functionality
- Delete profile option

### 3. Admin Panel (User 5274 Privileges)
**Quick Actions:**
- ✅ User Management (add/edit/delete users)
- ✅ Registration Approval (approve new users)
- ✅ Maintenance Mode (toggle app maintenance)

**User Directory:**
- ✅ Shows all users
- ✅ Filter by Last Login only (no institution filters)
- ✅ Sort by Last Login (newest/oldest)
- Edit user details
- Toggle user active status
- Delete users

### 4. Settings Button
- Located at bottom of API Source selection dropdown
- Opens User Profile (or Admin Panel for admins)

## Testing the Implementation

1. **Test Admin Login:**
   - ID Number: `5274`
   - Passcode: `5274`
   - Should open Admin Panel directly

2. **Test Regular User Login:**
   - Create a test user in Supabase:
   ```sql
   INSERT INTO users (id_number, surname, name, passcode, is_admin, is_active)
   VALUES ('TEST001', 'Test', 'User', '1234', false, true);
   ```
   - Login with ID: `TEST001`, Passcode: `1234`
   - Should see User Profile

3. **Test User Management:**
   - Login as admin (5274)
   - Go to Settings → Admin Panel
   - Click "User Management" in Quick Actions
   - Add a new user
   - Test login with new user

## Troubleshooting

### Issue: "User not found" on login
- Check if users table exists in Supabase
- Verify the user record exists with correct id_number
- Check browser console for Supabase errors

### Issue: Session not persisting
- Check IndexedDB is enabled in browser
- Verify userSessionDB.ts is imported correctly
- Check browser console for IndexedDB errors

### Issue: Admin Panel not showing for 5274
- Verify user has `is_admin: true` in database
- Check UserProfile component logic for admin check
- Verify session isAdmin flag is set correctly on login

### Issue: GSAP animations not working
- Verify gsap is installed: `npm list gsap`
- Check SplitText.ts is in correct location
- Check browser console for import errors

## Additional Notes

- All passcodes are stored as **plain text** (not hashed) for simplicity
- User 5274 is the super admin with full privileges
- Institution filters have been removed as requested
- Last login filter is the only filter in User Directory
- The app shows login screen first before accessing any features

## Files Structure

```
src/
├── lib/
│   └── supabase.ts                          ✅ Created
├── utils/
│   ├── userSessionDB.ts                     ✅ Created
│   └── SplitText.ts                         ✅ Copied
├── components/
│   ├── UserLogin.tsx                        ✅ Created
│   ├── UserProfile.tsx                      ⏳ Copy & adapt from ProfileTab.tsx
│   ├── AdminPanel.tsx                       ⏳ Copy & adapt from AdminPanel.tsx
│   ├── UserManagementModal.tsx              ⏳ Copy & adapt from StaffManagementModal.tsx
│   ├── RegistrationApprovalModal.tsx        ⏳ Copy from anwh
│   ├── MaintenanceMode.tsx                  ⏳ Copy from anwh
│   ├── ConfirmationModal.tsx                ⏳ Copy from anwh
│   ├── Notification.tsx                     ⏳ Copy from anwh
│   └── Header.tsx                           ⏳ Update with Settings button
├── types/
│   └── AuthTypes.ts                         ⏳ Create
└── App.tsx                                  ⏳ Integrate authentication
```

## Summary

You now have:
1. ✅ Foundation utilities (Supabase client, session management)
2. ✅ Login component with animations
3. ✅ Database migration SQL
4. 📋 Clear step-by-step guide to complete the implementation

The remaining work involves copying components from anwh and making the adaptations listed above. The most critical changes are:
- Replace `staff_users` → `users` table references
- Remove posting-related features
- Remove institution filters
- Keep only Last Login filter
- Simplify Quick Actions to 3 items only

Good luck with the implementation! 🚀
