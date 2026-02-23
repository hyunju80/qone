# Password Change Fix & UI Improvements

I have fixed the password change functionality and improved the UX as requested.

## Fixes & Features

### 1. Password Change Logic Fixed
- **Problem**: The frontend was trying to compare the "Current Password" with a local state that didn't exist (security best practice prevents sending password hash to frontend).
- **Solution**: Implemented a real verification API.
    - Added `PUT /api/v1/users/me/password` endpoint in backend.
    - This endpoint verifies the `current_password` against the stored hash in the database before allowing a change.
    - Updated frontend to call this API instead of local comparison.

### 2. UI Improvements
- **Eye Icons**: Added "Show/Hide" toggle icons (eye/eye-off) to all three password fields in the Profile modal.
- **Unified Alert System**: Replaced browser `alert()` popups with a custom, dark-themed Alert Modal that is consistent with the app's design language. Used for:
    - Operation Success/Failure notifications
    - Form Validation errors
    - Deletion Confirmations (Separate specific modal)

### 3. Workspace Display Fix
- **Problem**: "Manage Workspaces" and "Intelligence" modal were not showing workspaces for the selected customer.
- **Root Cause**: Backend API returns `customer_account_id` (snake_case) but Frontend expected `customerAccountId` (camelCase).
- **Fix**: Updated `api/projects.ts` to map the API response fields correctly, ensuring workspaces are linked to their respective customers.

## Usage
1. Click your profile (User Info) in the top right.
2. Enter your **Current Password**.
3. Enter your **New Password** (must be at least 8 characters, containing letters and numbers).
4. **Confirm** the new password.
5. Click **Update Credentials**.
6. The system will alert you upon success.

## Key Files Modified
- `backend/app/api/api_v1/endpoints/users.py` (New endpoint)
- `backend/app/schemas/user.py` (New schema)
- `api/users.ts` (New API method)
- `App.tsx` (UI and Logic update)
