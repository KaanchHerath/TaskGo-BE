# TaskGo API Documentation

## Task Management System

This document describes the comprehensive task management API with improved data models and workflow.

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Data Models

### Task Model
```javascript
{
  _id: ObjectId,
  title: String (required, max 100 chars),
  tags: [String] (lowercase),
  category: String (required, enum),
  minPayment: Number (required, min 1),
  maxPayment: Number (required, min 1, >= minPayment),
  agreedPayment: Number (between min and max),
  area: String (required, enum - Sri Lankan districts),
  startDate: Date (required, future date),
  endDate: Date (required, >= startDate),
  description: String (max 1000 chars),
  photos: [String] (valid URLs),
  status: String (enum: 'active', 'scheduled', 'completed', 'cancelled'),
  customer: ObjectId (ref: User, required),
  selectedTasker: ObjectId (ref: User),
  completionPhotos: [String],
  customerRating: Number (1-5),
  customerReview: String (max 500 chars),
  taskerConfirmed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Application Model
```javascript
{
  _id: ObjectId,
  task: ObjectId (ref: Task, required),
  tasker: ObjectId (ref: User, required),
  proposedPayment: Number (required, min 1),
  note: String (max 500 chars),
  status: String (enum: 'pending', 'confirmed', 'rejected'),
  estimatedDuration: Number (hours, min 0.5),
  availableStartDate: Date,
  availableEndDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### User Model (Enhanced)
```javascript
{
  _id: ObjectId,
  email: String (required, unique),
  password: String (required),
  role: String (enum: 'customer', 'tasker'),
  fullName: String,
  phone: String (required),
  
  // Enhanced rating system
  rating: {
    average: Number (0-5),
    count: Number,
    total: Number,
    
    // Category averages (for taskers)
    categoryAverages: {
      quality: Number (0-5),
      punctuality: Number (0-5),
      communication: Number (0-5),
      professionalism: Number (0-5)
    },
    
    // Rating distribution
    distribution: {
      fiveStars: Number,
      fourStars: Number,
      threeStars: Number,
      twoStars: Number,
      oneStar: Number
    }
  },
  
  // Enhanced statistics
  statistics: {
    tasksPosted: Number,
    tasksCompleted: Number,
    tasksAppliedTo: Number,
    tasksInProgress: Number,
    totalEarnings: Number,
    totalSpent: Number,
    responseTime: Number,
    completionRate: Number,
    repeatCustomers: Number
  },
  
  // Tasker specific fields
  taskerProfile: {
    skills: [String],
    country: String,
    area: String,
    idDocument: String,
    qualificationDocuments: [String]
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### Feedback Model
```javascript
{
  _id: ObjectId,
  task: ObjectId (ref: Task, required),
  fromUser: ObjectId (ref: User, required),
  toUser: ObjectId (ref: User, required),
  rating: Number (1-5, required),
  review: String (10-1000 chars, required),
  feedbackType: String (enum: 'customer-to-tasker', 'tasker-to-customer'),
  
  // Tasker feedback categories
  taskerFeedbackCategories: {
    quality: Number (1-5),
    punctuality: Number (1-5),
    communication: Number (1-5),
    professionalism: Number (1-5)
  },
  
  // Customer feedback categories
  customerFeedbackCategories: {
    clarity: Number (1-5),
    responsiveness: Number (1-5),
    cooperation: Number (1-5),
    fairness: Number (1-5)
  },
  
  isPublic: Boolean (default: true),
  response: {
    text: String (max 500 chars),
    createdAt: Date
  },
  helpfulVotes: Number,
  reportedBy: [{
    user: ObjectId (ref: User),
    reason: String (enum: 'inappropriate', 'fake', 'spam', 'offensive'),
    reportedAt: Date
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Task Management

**GET** `/tasks` - Get all active tasks with filters and pagination
- Query params: page, limit, category, area, minPayment, maxPayment, sortBy, sortOrder
- Access: Public

**GET** `/tasks/:id` - Get single task by ID
- Access: Public (active tasks), Private (other statuses)

**GET** `/tasks/customer/:customerId` - Get all tasks posted by a specific customer
- Query params: status, page, limit
- Access: Public
- Returns: Tasks with pagination and customer info

**POST** `/tasks` - Create new task
- Access: Private (Customer only)
- Body: title, description, category, minPayment, maxPayment, area, startDate, endDate, etc.

**GET** `/tasks/user/my-tasks` - Get current user's tasks
- Query params: status
- Access: Private
- Returns different data based on user role (customer/tasker)

**GET** `/tasks/user/my-applications` - Get current user's applications
- Query params: status  
- Access: Private (Tasker only)

**POST** `/tasks/:id/apply` - Apply for a task
- Access: Private (Tasker only)
- Body: proposedPayment, note, estimatedDuration

### Tasker Management

**GET** `/taskers` - Get all taskers with filtering, pagination, and sorting
- Query params: page, limit, skills, area, minRating, maxHourlyRate, search, sortBy, sortOrder
- Access: Public
- Returns: Taskers with enhanced statistics and real-time data

**GET** `/taskers/top-rated` - Get top rated taskers
- Query params: limit (default: 6)
- Access: Public
- Returns: Top rated taskers with calculated hourly rates and completion stats

**GET** `/taskers/:id` - Get detailed tasker information
- Access: Public
- Returns: Complete tasker profile with statistics, ratings, and availability

**PUT** `/taskers/availability` - Update tasker availability
- Access: Private (Tasker only)
- Body: isAvailable, availableHours
- Returns: Updated tasker profile

**GET** `/tasks/:id/applications` - Get applications for a task
- Query params: status
- Access: Private (Task owner only)

**POST** `/tasks/:id/select-tasker` - Select tasker for task
- Access: Private (Customer only)
- Body: applicationId, agreedPayment

**POST** `/tasks/:id/confirm-schedule` - Confirm task schedule
- Access: Private (Selected tasker only)

**POST** `/tasks/:id/tasker-complete` - Mark task complete (tasker)
- Access: Private (Selected tasker only)
- Body: completionPhotos, notes

**POST** `/tasks/:id/complete` - Complete task with rating
- Access: Private (Customer only)
- Body: rating, review

### User Management

### Feedback System API

### 12. Create Feedback
**POST** `/feedback`

**Access:** Private (Task participants only)

**Request Body:**
```json
{
  "taskId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "toUserId": "60f7b3b3b3b3b3b3b3b3b3b4",
  "rating": 5,
  "review": "Excellent work! Very professional and timely completion.",
  "feedbackType": "customer-to-tasker",
  "taskerFeedbackCategories": {
    "quality": 5,
    "punctuality": 5,
    "communication": 4,
    "professionalism": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback created successfully",
  "data": {
    "_id": "...",
    "rating": 5,
    "review": "...",
    "feedbackType": "customer-to-tasker",
    "fromUser": {
      "fullName": "John Doe",
      "role": "customer"
    },
    "toUser": {
      "fullName": "Jane Smith",
      "role": "tasker"
    },
    "task": {
      "title": "Plumbing Service",
      "category": "Plumbing"
    },
    "taskerFeedbackCategories": {...},
    "createdAt": "2025-01-23T...",
    ...
  }
}
```

### 13. Get User Feedback
**GET** `/feedback/user/:userId`

**Access:** Public

**Query Parameters:**
- `type` (string): Filter by feedback type ('customer-to-tasker' or 'tasker-to-customer')
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbacks": [
      {
        "_id": "...",
        "rating": 5,
        "review": "Excellent service!",
        "feedbackType": "customer-to-tasker",
        "fromUser": {
          "fullName": "John Doe",
          "role": "customer"
        },
        "task": {
          "title": "Plumbing Service",
          "category": "Plumbing"
        },
        "taskerFeedbackCategories": {
          "quality": 5,
          "punctuality": 5,
          "communication": 4,
          "professionalism": 5
        },
        "helpfulVotes": 3,
        "createdAt": "2025-01-23T...",
        ...
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25
    }
  }
}
```

### 14. Get User Rating Summary
**GET** `/feedback/rating-summary/:userId`

**Access:** Public

**Response:**
```json
{
  "success": true,
  "data": {
    "rating": {
      "average": 4.8,
      "count": 25,
      "total": 120,
      "categoryAverages": {
        "quality": 4.9,
        "punctuality": 4.7,
        "communication": 4.6,
        "professionalism": 4.9
      },
      "distribution": {
        "fiveStars": 18,
        "fourStars": 5,
        "threeStars": 2,
        "twoStars": 0,
        "oneStar": 0
      }
    },
    "statistics": {
      "tasksCompleted": 47,
      "tasksInProgress": 2,
      "totalEarnings": 2350,
      "responseTime": 1.2,
      "completionRate": 96.2,
      "repeatCustomers": 12
    },
    "role": "tasker",
    "recentFeedback": [
      {
        "_id": "...",
        "rating": 5,
        "review": "Outstanding work!",
        "fromUser": {
          "fullName": "Alice Johnson",
          "role": "customer"
        },
        "createdAt": "2025-01-20T..."
      }
    ]
  }
}
```

### 15. Add Feedback Response
**POST** `/feedback/:feedbackId/response`

**Access:** Private (Feedback recipient only)

**Request Body:**
```json
{
  "response": "Thank you for the positive feedback! It was a pleasure working with you."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Response added successfully",
  "data": {
    "_id": "...",
    "response": {
      "text": "Thank you for the positive feedback!...",
      "createdAt": "2025-01-23T..."
    },
    ...
  }
}
```

### 16. Vote Feedback as Helpful
**POST** `/feedback/:feedbackId/helpful`

**Access:** Private

**Response:**
```json
{
  "success": true,
  "message": "Feedback marked as helpful",
  "data": {
    "helpfulVotes": 4
  }
}
```

### 17. Report Feedback
**POST** `/feedback/:feedbackId/report`

**Access:** Private

**Request Body:**
```json
{
  "reason": "inappropriate"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback reported successfully"
}
```

## Task & Feedback Workflow

### Task Workflow
1. **Customer creates task** → Status: `active`
2. **Taskers apply** → Applications created with status: `pending`
3. **Customer selects tasker** → Task status: `scheduled`, Selected application: `confirmed`, Others: `rejected`
4. **Tasker confirms schedule** → `taskerConfirmed`: true
5. **Tasker completes work** → Uploads completion photos/notes
6. **Customer confirms completion** → Task status: `completed`

### Feedback Workflow (Post-Completion)
7. **Customer gives feedback to tasker** → Creates feedback with `feedbackType: 'customer-to-tasker'`
   - Overall rating (1-5 stars)
   - Category ratings: quality, punctuality, communication, professionalism
   - Written review
8. **Tasker gives feedback to customer** → Creates feedback with `feedbackType: 'tasker-to-customer'`
   - Overall rating (1-5 stars)
   - Category ratings: clarity, responsiveness, cooperation, fairness
   - Written review
9. **Automatic updates** → User ratings, statistics, and completion rates updated
10. **Optional responses** → Feedback recipients can respond to reviews
11. **Community interaction** → Users can vote feedback as helpful or report inappropriate content

## Categories

- Home Maintenance
- Cleaning
- Moving
- Handyman
- Gardening
- Painting
- Plumbing
- Electrical
- Carpentry
- Assembly
- Delivery
- Personal Assistant
- Pet Care
- Tutoring
- Other

## Sri Lankan Districts (Areas)

- Colombo, Gampaha, Kalutara, Kandy, Matale, Nuwara Eliya
- Galle, Matara, Hambantota, Jaffna, Kilinochchi, Mannar
- Vavuniya, Mullaitivu, Batticaloa, Ampara, Trincomalee
- Kurunegala, Puttalam, Anuradhapura, Polonnaruwa, Badulla
- Moneragala, Ratnapura, Kegalle

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Title is required", "Invalid category selected"]
}
```

**Feedback-specific 400 errors:**
```json
{
  "success": false,
  "message": "Feedback can only be given for completed tasks"
}
```

```json
{
  "success": false,
  "message": "Feedback already exists for this task"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Only customers can create tasks"
}
```

**Feedback-specific 403 errors:**
```json
{
  "success": false,
  "message": "You can only give feedback for tasks you were involved in"
}
```

```json
{
  "success": false,
  "message": "You can only respond to feedback given to you, and only once"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Task not found"
}
```

```json
{
  "success": false,
  "message": "Feedback not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error while creating task"
}
```

```json
{
  "success": false,
  "message": "Server error while creating feedback"
}
```

## Database Indexes

For optimal performance, the following indexes are created:

### Task Collection
- `{ status: 1, area: 1 }` - For filtering active tasks by area
- `{ customer: 1, status: 1 }` - For customer's task queries
- `{ selectedTasker: 1, status: 1 }` - For tasker's task queries
- `{ category: 1, status: 1 }` - For category filtering
- `{ createdAt: -1 }` - For sorting by creation date

### Application Collection
- `{ task: 1, tasker: 1 }` - Unique compound index
- `{ task: 1, status: 1 }` - For task applications
- `{ tasker: 1, status: 1 }` - For tasker applications
- `{ createdAt: -1 }` - For sorting

### Feedback Collection
- `{ task: 1, fromUser: 1, toUser: 1, feedbackType: 1 }` - Unique compound index (prevents duplicate feedback)
- `{ toUser: 1, feedbackType: 1 }` - For user feedback queries
- `{ fromUser: 1 }` - For feedback given by user
- `{ task: 1 }` - For task-specific feedback
- `{ rating: 1 }` - For rating-based queries
- `{ createdAt: -1 }` - For chronological sorting

### User Collection
- `{ email: 1 }` - Unique index for authentication
- `{ role: 1, 'rating.average': -1 }` - For top-rated users by role
- `{ 'statistics.tasksCompleted': -1 }` - For most experienced users

## Feedback System Features

### Bidirectional Rating System
- **Customer-to-Tasker**: Quality, punctuality, communication, professionalism
- **Tasker-to-Customer**: Clarity, responsiveness, cooperation, fairness
- **Overall Rating**: 1-5 star system with automatic averaging
- **Rating Distribution**: Track distribution of ratings received

### Enhanced User Statistics
- **Task Metrics**: Posted, completed, in-progress counts
- **Financial Tracking**: Total earnings (taskers) and spending (customers)
- **Performance Metrics**: Completion rates, response times
- **Repeat Business**: Track repeat customer relationships

### Community Features
- **Public Reviews**: Transparent feedback system
- **Helpful Votes**: Community can vote on helpful reviews
- **Response System**: Recipients can respond to feedback
- **Abuse Reporting**: Report inappropriate or fake reviews

### Data Privacy & Security
- **Access Control**: Only task participants can create feedback
- **Duplicate Prevention**: One feedback per task per user pair
- **Validation**: Comprehensive input validation and sanitization
- **Public/Private Options**: Control feedback visibility

### Migration Support
- **Seamless Upgrade**: Existing task ratings migrate to new system
- **Statistics Calculation**: Historical data used to calculate accurate statistics
- **Backward Compatibility**: Existing APIs enhanced, not broken

## Testing

Run the comprehensive test suite:
```bash
npm test -- task.test.js
```

Test feedback system:
```bash
npm test -- feedback.test.js
```

## Migration

To upgrade existing database to the new feedback system:
```bash
node migration-feedback-system.js
```

This migration will:
- Add new rating and statistics fields to all users
- Calculate actual statistics from historical data
- Migrate existing task ratings to feedback system
- Update user rating averages based on migrated feedback

The test suite covers:
- Task creation and validation
- Application workflow
- Task selection and scheduling
- Completion process
- Error handling
- Model validations
- Authentication and authorization 