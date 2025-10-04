# BCI Parking - User Management Features Documentation

## Overview
Comprehensive documentation of all user management features in the BCI Parking Spot Sharing Application. This system provides administrators with complete control over user lifecycle management, including creation, editing, status management, and advanced filtering capabilities.

---

## Table of Contents
1. [User Creation](#user-creation)
2. [User Editing](#user-editing)
3. [User Deletion (Soft Delete)](#user-deletion-soft-delete)
4. [User Restoration](#user-restoration)
5. [User Status Management](#user-status-management)
6. [Search & Filtering](#search--filtering)
7. [Role Management](#role-management)
8. [Parking Spot Assignment](#parking-spot-assignment)
9. [Export Functionality](#export-functionality)
10. [Security & Permissions](#security--permissions)
11. [Audit Trail](#audit-trail)
12. [API Endpoints](#api-endpoints)

---

## 1. User Creation

### Features
- **Add New Users**: Admins can create new users manually through the admin interface
- **Form Validation**: Comprehensive validation for all user fields
- **Duplicate Prevention**: Automatic detection and prevention of duplicate email addresses
- **Auto-formatting**: Phone numbers are automatically formatted for consistency

### Validation Rules
- **First Name**: 2-50 characters, letters, spaces, hyphens, and apostrophes only
- **Last Name**: 2-50 characters, letters, spaces, hyphens, and apostrophes only
- **Email**: Valid email format, maximum 100 characters, must be unique
- **Phone**: Optional, 10 digits, auto-formatted to "(123) 456-7890" for display
- **Department**: Selected from database-driven dropdown
- **Role**: Selected from available roles (admin, owner, renter)
- **Status**: Default is "active", can be set during creation

### User Interface
- **Location**: Admin Dashboard → User Management → "Add User" button
- **Form Fields**:
  - First Name (required)
  - Last Name (required)
  - Email (required, unique)
  - Phone (optional)
  - Department (dropdown, required)
  - Role (dropdown, required)
  - Status (dropdown, default: Active)
  - Member Since (date picker)

### Backend Behavior
- Validates email uniqueness
- Returns 409 Conflict error if email already exists
- Stores phone in digits-only format (e.g., "1234567890")
- Creates user with specified role immediately
- Logs user creation to audit trail

### Frontend Behavior
- Double-click protection prevents duplicate submissions
- Real-time form validation
- Success/error toast notifications
- Auto-refresh user list after successful creation

---

## 2. User Editing

### Features
- **Update User Information**: Modify any user field except email (for security)
- **Role Assignment**: Change user roles (admin, owner, renter)
- **Status Modification**: Change user status (active, suspended)
- **Form Pre-population**: Existing data automatically loaded into edit form

### Editable Fields
- First Name
- Last Name
- Email (read-only for existing users to prevent identity changes)
- Phone
- Department
- Role
- Status (active/suspended for active users, active/suspended for suspended users)
- Member Since date

### User Interface
- **Access**: Click "Edit" button (pencil icon) in user table row
- **Form Dialog**: Opens modal with pre-filled user data
- **Save Changes**: Submit button updates user information
- **Cancel**: Discard changes without saving

### Validation
- Same validation rules as user creation
- Email uniqueness check (excluding current user)
- Cannot set status to "deleted" through edit form (use delete action instead)

### Backend Behavior
- PATCH request to update user
- Validates all fields before saving
- Returns 409 if email conflicts with another user
- Logs changes to audit trail
- Updates timestamp automatically

---

## 3. User Deletion (Soft Delete)

### Features
- **Soft Delete**: Users are marked as deleted, not permanently removed
- **Data Preservation**: All user data, parking spots, bookings, and history preserved
- **Audit Trail**: Complete record of who deleted whom and when
- **Confirmation Required**: Two-step confirmation prevents accidental deletion

### How It Works
1. Admin clicks "Delete" button (trash icon) for a user
2. Confirmation dialog appears with user name
3. Upon confirmation, user status set to "deleted"
4. User immediately blocked from logging in
5. User hidden from default user lists
6. All historical data preserved in database

### Database Changes
- **Status Field**: Set to "deleted"
- **deletedAt Timestamp**: Set to current date/time
- **Other Data**: Unchanged and preserved
- **Relationships**: Parking spots, bookings, vehicles remain intact

### User Interface
- **Delete Button**: Trash icon in actions column (only for non-deleted users)
- **Confirmation Dialog**: Shows user name and asks for confirmation
- **Success Toast**: Confirmation message after successful deletion
- **Table Update**: User removed from active users list (unless filtered)

### Backend Behavior
- Updates user status to "deleted"
- Sets deletedAt timestamp
- Excludes from default queries (WHERE status != 'deleted')
- Preserves all foreign key relationships
- Logs deletion to audit trail

---

## 4. User Restoration

### Features
- **Restore Deleted Users**: Admins can restore soft-deleted users back to active status
- **Complete Data Recovery**: All user data, spots, and history restored
- **Status Reset**: User status changed back to "active"
- **Login Re-enabled**: User can log in again after restoration

### How It Works
1. Admin filters for "Deleted" users in status dropdown
2. Deleted users appear in table with "Deleted" badge
3. Restore button (Undo icon) appears instead of Edit/Delete buttons
4. Click restore button to reactivate user
5. User status changed to "active" and deletedAt cleared
6. User can immediately log in again

### Database Changes
- **Status Field**: Changed from "deleted" to "active"
- **deletedAt Timestamp**: Cleared (set to null)
- **Other Data**: Unchanged (was never modified)

### User Interface
- **Access**: Filter users by "Deleted" status
- **Restore Button**: Undo icon appears only for deleted users
- **Confirmation**: No confirmation dialog (restore is safe operation)
- **Success Toast**: Confirmation message after restoration
- **Table Update**: User moves to active users list

### Backend Endpoint
- **Route**: PATCH /api/admin/users/:id/restore
- **Validation**: Verifies user exists and is deleted
- **Response**: Returns 400 if user is not deleted
- **Audit**: Logs restoration action with admin details

---

## 5. User Status Management

### Status Types
1. **Active**: Normal user with full access
2. **Suspended**: User blocked from login but data preserved
3. **Deleted**: Soft-deleted user, hidden from default views

### Status Transitions
- Active → Suspended: Via edit form
- Active → Deleted: Via delete action
- Suspended → Active: Via edit form
- Suspended → Deleted: Via delete action
- Deleted → Active: Via restore action

### Login Behavior by Status
- **Active**: Can log in normally
- **Suspended**: Blocked at login, sees "account suspended" message
- **Deleted**: Blocked at login, sees "account not found" message

### Status Badge Display
- **Active**: Blue badge with "Active" text
- **Suspended**: Orange badge with "Suspended" text
- **Deleted**: Red badge with "Deleted" text

### Implementation Details
- Status checked after OIDC authentication
- Session destroyed before redirect for suspended/deleted users
- Error parameter passed to login page via query string
- Appropriate error message displayed on login page

---

## 6. Search & Filtering

### Search Functionality
- **Real-time Search**: Instant filtering as you type
- **Search Fields**: Name, email, department
- **Case-insensitive**: Matches regardless of letter case
- **Partial Matching**: Finds users with partial text matches

### Filter Options

#### Status Filter
- All (default)
- Active
- Suspended
- Deleted

#### Role Filter
- All (default)
- Admin
- Owner
- Renter

#### Department Filter
- All (default)
- Dynamic list from database
- IT, HR, Finance, Operations, Marketing, Customer Service, Sales, Legal

#### Spots Owned Filter
- All (default)
- With Spots (spotsOwned > 0)
- Without Spots (spotsOwned = 0)

### Filter Combinations
- Multiple filters can be applied simultaneously
- Filters work together (AND logic)
- "Clear Filters" button resets all filters and search

### User Interface
- **Search Box**: Top of user table with search icon
- **Filter Dropdowns**: Status, Role, Department, Spots Owned
- **Clear Filters Button**: Resets all filters at once
- **Results Count**: Shows "X shown" of "Y total" users

---

## 7. Role Management

### Available Roles
1. **Admin**: Full system access, can manage users and settings
2. **Owner**: Has assigned parking spots, can list spots
3. **Renter**: Can search and book available parking spots

### Role Assignment
- **During Creation**: Select role from dropdown when creating user
- **During Editing**: Change role via edit form
- **Multiple Roles**: Users can have multiple roles (e.g., admin + owner)
- **Automatic Owner Role**: Assigned automatically when user gets a parking spot

### Admin Role Assignment
- **Hardcoded Admins**: Specific email addresses auto-assigned admin role
- **Manual Assignment**: Admins can assign admin role to other users
- **Email Matching**: Pre-created admin users matched by email during OIDC login

### Role-Based Access
- **Landing Pages**:
  - Admin → /admin (Admin Dashboard)
  - Owner → /my-spots (My Parking Spots)
  - Renter → /search (Smart Parking Search)
- **Navigation**: Different menu items based on role
- **Features**: Role-specific functionality and permissions

### Role Display
- **Badge Colors**:
  - Admin: Red badge
  - Owner: Blue badge
  - Renter: Gray badge
- **Multiple Roles**: Displayed as multiple badges
- **Table Column**: Shows all user roles

---

## 8. Parking Spot Assignment

### Direct Assignment Feature
- **Admin Capability**: Admins can directly assign parking spots to users
- **User Search**: Real-time searchable dropdown for user selection
- **Spot Selection**: Choose from available unallocated spots
- **Automatic Owner Role**: User automatically gets "owner" role when spot assigned

### Assignment Process
1. Navigate to Parking Management page
2. Find unallocated spot in spots table
3. Click "Assign" button for the spot
4. Search for user by name or email (min 3 characters)
5. Select user from dropdown
6. Confirm assignment
7. Spot assigned, user gets owner role

### User Search Features
- **Minimum Characters**: 3 characters to trigger search
- **Debounce**: 300ms delay to prevent excessive queries
- **Real-time Results**: Database search with live results
- **Display Format**: Shows name and email
- **No Results**: Clear message when no users found

### Backend Behavior
- Updates parking spot owner_id
- Assigns "owner" role if user doesn't have it
- Logs assignment to audit trail
- Updates spot status to allocated
- Invalidates relevant caches

---

## 9. Export Functionality

### Export Formats

#### PDF Export
- **File Name**: "BCI_User_Directory_Report_YYYY-MM-DD.pdf"
- **Layout**: Professional table format with company branding
- **Includes**: Name, Email, Department, Role, Status, Spots Owned, Bookings
- **Auto-download**: Browser automatically downloads file

#### Excel Export
- **File Name**: "BCI_User_Directory_YYYY-MM-DD.xlsx"
- **Format**: Excel 2007+ (.xlsx)
- **Headers**: Fully formatted with bold text
- **Data**: All visible user data with proper formatting
- **Auto-download**: Browser automatically downloads file

### Export Features
- **Current View**: Exports exactly what's visible in table
- **Respects Filters**: Only exports filtered/searched users
- **Respects Sorting**: Maintains current sort order
- **Quick Access**: Export buttons in table header
- **Error Handling**: Toast notifications for export errors

### User Interface
- **PDF Button**: "PDF" with document icon
- **Excel Button**: "Excel" with download icon
- **Button States**: Disabled when no users to export
- **Success Feedback**: Success toast after successful export

---

## 10. Security & Permissions

### Authentication Requirements
- **Admin Only**: All user management features require admin role
- **Session-based**: Server-side session validation
- **OIDC Integration**: Replit OIDC for authentication

### Authorization Checks
- **Route Protection**: requireAdmin middleware on all admin endpoints
- **Component Protection**: UI hidden for non-admin users
- **API Validation**: Double-check permissions on backend
- **Base Role Check**: Uses true admin role, not impersonated role

### Data Protection
- **Email Uniqueness**: Prevents duplicate accounts
- **Password**: Not stored (OIDC handles authentication)
- **Sensitive Data**: Phone numbers stored in normalized format
- **Session Security**: SameSite=lax cookie protection

### Audit Trail
- **All Actions Logged**: Create, edit, delete, restore, suspend, activate
- **Admin Tracking**: Records which admin performed action
- **Timestamp**: Exact time of each action
- **Entity Type**: Categorized by entity type (user, parking_spot, etc.)
- **Details**: Action description and relevant data

---

## 11. Audit Trail

### Logged Actions
- User creation
- User updates (with changed fields)
- User deletion
- User restoration
- User suspension
- User activation
- Parking spot assignment
- Role changes

### Audit Record Fields
- **ID**: Unique identifier
- **adminId**: ID of admin who performed action
- **adminName**: Name of admin
- **action**: Type of action performed
- **entityType**: Type of entity affected (user, parking_spot, etc.)
- **entityId**: ID of affected entity
- **details**: JSON object with action details
- **timestamp**: When action occurred

### Access & Viewing
- **Admin Dashboard**: Audit log viewer (if implemented)
- **Database Query**: Direct access via database
- **Filtering**: By admin, entity type, date range
- **Export**: Can export audit logs for compliance

---

## 12. API Endpoints

### User Management Endpoints

#### GET /api/admin/users
- **Description**: Get all users with filtering
- **Auth**: Admin required
- **Query Params**: status, role, department, search
- **Response**: Array of user objects with spots and bookings count

#### POST /api/admin/users
- **Description**: Create new user
- **Auth**: Admin required
- **Body**: firstName, lastName, email, phone, department, role, status
- **Response**: Created user object
- **Errors**: 409 if email exists

#### PATCH /api/admin/users/:id
- **Description**: Update existing user
- **Auth**: Admin required
- **Body**: Partial user object with fields to update
- **Response**: Updated user object
- **Errors**: 404 if user not found, 409 if email conflict

#### DELETE /api/admin/users/:id
- **Description**: Soft delete user (set status to deleted)
- **Auth**: Admin required
- **Response**: Success message
- **Errors**: 404 if user not found

#### PATCH /api/admin/users/:id/restore
- **Description**: Restore soft-deleted user
- **Auth**: Admin required
- **Response**: Success message and updated user
- **Errors**: 404 if user not found, 400 if user not deleted

#### GET /api/admin/user-metrics
- **Description**: Get user statistics
- **Auth**: Admin required
- **Response**: Metrics object with counts and percentages

### Parking Spot Assignment Endpoints

#### PATCH /api/admin/parking-spots/:id/assign
- **Description**: Assign spot to user
- **Auth**: Admin required
- **Body**: userId
- **Response**: Updated spot object
- **Errors**: 404 if spot/user not found

#### PATCH /api/admin/parking-spots/:id/unassign
- **Description**: Unassign spot from user
- **Auth**: Admin required
- **Response**: Updated spot object
- **Errors**: 404 if spot not found

### Search Endpoints

#### GET /api/admin/users/search
- **Description**: Search users by name or email
- **Auth**: Admin required
- **Query Params**: q (search query, min 3 chars)
- **Response**: Array of matching users

#### GET /api/admin/departments
- **Description**: Get all departments
- **Auth**: Admin required
- **Response**: Array of department names

---

## Additional Features

### User Metrics Dashboard
- Total users count
- Active users count
- Suspended users count
- Deleted users count (when filtered)
- Users with parking spots
- Users without parking spots
- Role distribution percentages

### Table Features
- **Sortable Columns**: Click headers to sort by any column
- **Pagination**: (If implemented) Navigate through large user lists
- **Row Actions**: Edit, Delete, Restore (context-dependent)
- **Status Badges**: Visual status indicators
- **Role Badges**: Multiple role display
- **Avatar Display**: User initials or profile picture
- **Responsive Design**: Works on all screen sizes

### Form Validation
- Real-time validation as user types
- Clear error messages for each field
- Submit button disabled until form valid
- Required field indicators
- Format hints (e.g., phone number format)

### User Experience
- Toast notifications for all actions
- Confirmation dialogs for destructive actions
- Loading states during operations
- Error handling with helpful messages
- Auto-refresh after data changes
- Keyboard navigation support
- Accessibility compliance (WCAG)

---

## Database Schema

### Users Table
```
- id (primary key)
- firstName (varchar)
- lastName (varchar)
- email (varchar, unique)
- phone (varchar, nullable)
- department (varchar)
- roles (array)
- status (enum: active, suspended, deleted)
- deletedAt (timestamp, nullable)
- memberSince (date)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Audit Trail Table
```
- id (primary key)
- adminId (foreign key → users.id)
- adminName (varchar)
- action (varchar)
- entityType (varchar)
- entityId (varchar)
- details (jsonb)
- timestamp (timestamp)
```

---

## Best Practices

### Admin Responsibilities
1. Always verify user information before creation
2. Use soft delete (not hard delete) to preserve audit trail
3. Document reason for suspension in audit notes
4. Regularly review deleted users for restoration or permanent removal
5. Export user lists for backup and compliance
6. Monitor audit trail for unusual activity

### Data Management
1. Phone numbers stored without formatting for consistency
2. Email addresses are unique identifiers
3. Deleted users retain all historical data
4. Role changes trigger automatic permission updates
5. Status changes are immediately enforced

### Security Considerations
1. Only admins can access user management
2. All actions are logged to audit trail
3. Sensitive operations require confirmation
4. Session-based authentication with CSRF protection
5. Regular audit trail reviews recommended

---

## Troubleshooting

### Common Issues

**User Can't Log In**
- Check user status (must be "active")
- Verify email address matches OIDC provider
- Check if user was recently deleted or suspended

**Duplicate Email Error**
- Email already exists in system
- Search for existing user
- Update existing user instead of creating new

**Spot Assignment Fails**
- Verify spot is unallocated
- Check user exists and is active
- Ensure admin has proper permissions

**Export Not Working**
- Check if users exist in filtered view
- Verify browser allows downloads
- Check console for errors

---

## Future Enhancements (Roadmap)

### Planned Features
- Bulk user import from CSV/Excel
- Advanced audit log filtering and export
- User activity timeline
- Automated user provisioning from HR system
- Custom role creation and permissions
- User groups and bulk actions
- Email notifications for user actions
- Password reset for local accounts (if implemented)

### Under Consideration
- User profile pictures
- Custom fields per user
- Integration with external authentication providers
- Advanced reporting and analytics
- User communication tools
- Automated suspension rules

---

## Support & Documentation

### Getting Help
- Contact system administrator
- Review this documentation
- Check audit trail for action history
- Export user data for analysis

### Related Documentation
- BCI Parking System Overview
- Admin Dashboard Guide
- Parking Spot Management Guide
- Security & Permissions Guide
- API Documentation

---

**Document Version**: 1.0  
**Last Updated**: October 4, 2025  
**Maintained By**: BCI IT Department  
**Contact**: support@bci.com
