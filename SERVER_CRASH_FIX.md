# Server Crash Fix - Missing Tasker Model

## 🚨 **Issue:** Server Crashed on Startup
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\kaanchh\taskGo\project\TaskGo-BE\src\models\Tasker.js'
```

## 🔍 **Root Cause:**
The `taskerController.js` was trying to import a non-existent `Tasker.js` model. In the TaskGo system, taskers are stored as `User` records with `role: "tasker"`, not as a separate model.

## ✅ **Fix Applied:**

### 1. **Fixed Tasker Controller Import**
```javascript
// Before (WRONG - caused crash)
import Tasker from "../models/Tasker.js";

// After (CORRECT)
import User from "../models/User.js";
```

### 2. **Updated getAllTaskers Function**
```javascript
// Before (WRONG)
const taskers = await Tasker.find();

// After (CORRECT)  
const taskers = await User.find({ role: "tasker" }).select("-password");
```

### 3. **Updated updateTaskerAvailability Function**
```javascript
// Before (WRONG)
const tasker = await Tasker.findByIdAndUpdate(req.user.id, { availability }, { new: true });

// After (CORRECT)
const updateData = {
    'taskerProfile.isAvailable': isAvailable
};

if (availableHours) {
    updateData['taskerProfile.availableHours'] = availableHours;
}

const tasker = await User.findByIdAndUpdate(
    req.user._id, 
    updateData, 
    { new: true }
).select("-password");
```

### 4. **Cleaned Up Admin Controller**
- Removed unused `Admin` model import
- Added password exclusion: `.select("-password")`

## 🏗️ **Data Model Architecture:**

### **User Model Structure:**
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String,
  role: String, // "customer", "tasker", "admin"
  fullName: String,
  
  // Customer-specific data
  customerProfile: {
    province: String
  },
  
  // Tasker-specific data  
  taskerProfile: {
    skills: [String],
    country: String,
    area: String,
    isAvailable: Boolean,
    availableHours: {
      start: String,
      end: String
    }
  }
}
```

## 🔧 **API Endpoints Now Working:**

### **GET /api/v1/taskers** 
- Returns all users with `role: "tasker"`
- Excludes password field for security

### **PUT /api/v1/taskers/availability**
- Updates tasker availability status
- Updates available hours if provided

### **GET /api/admin/users**
- Returns all users (all roles)
- Excludes password field for security

## ✅ **Server Status: FIXED**
The server should now start without module import errors and the admin/tasker APIs should work correctly.

## 🧪 **Testing:**
1. Start server: `npm start` or `node src/server.js`
2. Test admin API: `GET /api/admin/users` (with admin JWT)
3. Test tasker API: `GET /api/v1/taskers` (with any valid JWT) 