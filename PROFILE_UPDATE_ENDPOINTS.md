# Profile Update Endpoints

This document describes the new endpoints added to allow users to edit their profiles.

## Endpoints

### 1. Update Profile
**PUT** `/api/users/profile`

Updates user profile information including basic details and role-specific profile data.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "fullName": "Updated Full Name",
  "phone": "+94712345678",
  "taskerProfile": {
    "bio": "Updated bio text",
    "experience": "3-5 years",
    "skills": ["Cleaning", "Plumbing", "Electrical"],
    "area": "Colombo",
    "hourlyRate": 2500,
    "advancePaymentAmount": 5000,
    "isAvailable": true
  },
  "customerProfile": {
    "province": "Western",
    "bio": "Customer bio"
  }
}
```

#### Response
```json
{
  "message": "Profile updated successfully",
  "_id": "user_id",
  "fullName": "Updated Full Name",
  "email": "user@example.com",
  "phone": "+94712345678",
  "role": "tasker",
  "taskerProfile": {
    "bio": "Updated bio text",
    "experience": "3-5 years",
    "skills": ["Cleaning", "Plumbing", "Electrical"],
    "area": "Colombo",
    "hourlyRate": 2500,
    "advancePaymentAmount": 5000,
    "isAvailable": true
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Change Password
**PUT** `/api/users/change-password`

Changes the user's password after validating the current password.

#### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewPassword123!"
}
```

#### Response
```json
{
  "message": "Password changed successfully"
}
```

## Field Validations

### Phone Number
- Must match regex: `^\+?[\d\s-]{10,}$`
- Must be unique across all users

### Password (for change password)
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Must contain special character
- Cannot be the same as current password

### Tasker Profile Fields
- **skills**: Array of strings, at least one required for taskers
- **experience**: Enum values: "0-1 years", "1-3 years", "3-5 years", "5+ years"
- **bio**: String, max 1000 characters
- **hourlyRate**: Number, minimum 0
- **advancePaymentAmount**: Number, minimum 0, defaults to 0
- **isAvailable**: Boolean, defaults to true

### Customer Profile Fields
- **bio**: String, max 500 characters
- **province**: String

## Error Responses

### 400 Bad Request
```json
{
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "message": "Not authorized, invalid token"
}
```

### 404 Not Found
```json
{
  "message": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "An error occurred while updating profile"
}
```

## Frontend Integration

The frontend can use the new `profileService.js` utility:

```javascript
import { updateProfile, changePassword, buildProfileUpdatePayload } from '../../services/api/profileService';

// Update profile
const profileData = buildProfileUpdatePayload(formData, userRole);
await updateProfile(profileData);

// Change password
await changePassword(currentPassword, newPassword);
```

## Database Schema Updates

Added new fields to the User model:

### Tasker Profile
- `bio`: String (max 1000 chars)
- `experience`: String (enum)
- `hourlyRate`: Number
- `advancePaymentAmount`: Number (min 0, default 0)
- `isAvailable`: Boolean

### Customer Profile
- `province`: String
- `bio`: String (max 500 chars) 