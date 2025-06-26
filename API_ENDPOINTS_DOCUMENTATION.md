# TaskGo API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
Most endpoints require JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Authentication Endpoints

### POST /api/auth/register
**Description:** Register a new user (customer or tasker)  
**Access:** Public  
**Headers:** Content-Type: application/json  

**Request Body (Customer):**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "phone": "+94771234567",
  "password": "SecurePass123!",
  "role": "customer",
  "fullName": "John Doe",
  "province": "Colombo"
}
```

**Request Body (Tasker):**
```json
{
  "username": "jane_smith",
  "email": "jane@example.com",
  "phone": "+94771234568",
  "password": "SecurePass123!",
  "role": "tasker",
  "fullName": "Jane Smith",
  "skills": ["Plumbing", "Electrical"],
  "country": "Sri Lanka",
  "area": "Colombo",
  "identificationDocument": "ID123456789",
  "qualificationDocuments": ["CERT001", "CERT002"]
}
```

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49f1b2c8b1f8e4e1a1",
    "username": "john_doe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+94771234567",
    "role": "customer"
  }
}
```

### POST /api/auth/register-tasker
**Description:** Register a new tasker with file uploads  
**Access:** Public  
**Headers:** Content-Type: multipart/form-data  

**Form Data:**
- email: tasker@example.com
- password: SecurePass123!
- fullName: Jane Smith
- skills: Plumbing (can be multiple)
- country: Sri Lanka
- area: Colombo
- idDocument: (file upload)
- qualificationDocuments: (file uploads, max 10)

### POST /api/auth/login
**Description:** Login user and get JWT token  
**Access:** Public  
**Headers:** Content-Type: application/json  

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ec49f1b2c8b1f8e4e1a1",
    "username": "john_doe",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  }
}
```

---

## 2. Tasker Management Endpoints

### GET /api/v1/taskers
**Description:** Get all taskers with filtering, pagination, and sorting  
**Access:** Public  

**Query Parameters:**
- page: Page number (default: 1)
- limit: Items per page (default: 12)
- skills: Filter by skills (can be multiple)
- area: Filter by area/location
- minRating: Filter by minimum rating
- maxHourlyRate: Filter by maximum hourly rate
- search: Search in name or skills
- sortBy: Sort field (default: 'rating.average')
- sortOrder: Sort order 'asc' or 'desc' (default: 'desc')

**Example URL:**
```
GET /api/v1/taskers?page=1&limit=12&skills=Cleaning&area=Colombo&minRating=4.0&sortBy=rating.average&sortOrder=desc
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "tasker_id",
      "fullName": "Tasker Name",
      "email": "tasker@email.com",
      "role": "tasker",
      "taskerProfile": {
        "skills": ["Cleaning", "Handyman"],
        "area": "Colombo",
        "isAvailable": true
      },
      "rating": {
        "average": 4.8,
        "count": 25
      },
      "completedTasks": 45,
      "avgResponseTime": 2,
      "hourlyRate": 30,
      "isOnline": true,
      "responseRate": 98
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 50,
    "pages": 5
  }
}
```

### GET /api/v1/taskers/top-rated
**Description:** Get top rated taskers  
**Access:** Public  

**Query Parameters:**
- limit: Number of taskers to return (default: 6)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "tasker_id",
      "fullName": "Top Tasker",
      "taskerProfile": {
        "skills": ["Plumbing", "Electrical"],
        "area": "Kandy"
      },
      "rating": {
        "average": 4.9,
        "count": 50
      },
      "completedTasks": 75,
      "hourlyRate": 35,
      "isOnline": true
    }
  ]
}
```

### GET /api/v1/taskers/:id
**Description:** Get detailed information about a specific tasker  
**Access:** Public  

**URL Parameters:**
- id: MongoDB ObjectId of the tasker

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "tasker_id",
    "fullName": "Tasker Name",
    "email": "tasker@email.com",
    "taskerProfile": {
      "skills": ["Cleaning", "Handyman"],
      "area": "Colombo",
      "isAvailable": true,
      "bio": "Experienced professional..."
    },
    "rating": {
      "average": 4.8,
      "count": 25
    },
    "completedTasks": 45,
    "activeTasks": 3,
    "totalApplications": 120,
    "avgResponseTime": 2,
    "hourlyRate": 30,
    "isOnline": true,
    "responseRate": 98
  }
}
```

### PUT /api/v1/taskers/availability
**Description:** Update tasker availability status  
**Access:** Private (Tasker only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "isAvailable": true,
  "availableHours": {
    "monday": { "start": "09:00", "end": "17:00" },
    "tuesday": { "start": "09:00", "end": "17:00" }
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "tasker_id",
    "taskerProfile": {
      "isAvailable": true,
      "availableHours": {...}
    }
  }
}
```

---

## 3. Task Management Endpoints

### POST /api/v1/tasks
**Description:** Create a new task  
**Access:** Private (Customer only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "title": "Fix Kitchen Sink",
  "description": "Need someone to fix a leaky kitchen sink. Basic plumbing skills required.",
  "category": "Plumbing",
  "tags": ["plumbing", "sink", "repair"],
  "minPayment": 50,
  "maxPayment": 100,
  "area": "Colombo",
  "startDate": "2024-02-01T09:00:00.000Z",
  "endDate": "2024-02-01T17:00:00.000Z",
  "photos": ["https://example.com/photo1.jpg"]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a2",
    "title": "Fix Kitchen Sink",
    "description": "Need someone to fix a leaky kitchen sink...",
    "category": "Plumbing",
    "status": "active",
    "customer": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a1",
      "fullName": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-20T10:00:00.000Z"
  }
}
```

### GET /api/v1/tasks
**Description:** Get all active tasks with optional filters and pagination  
**Access:** Public  

**Query Parameters:**
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- category: Filter by category
- area: Filter by area
- minPayment: Minimum payment filter
- maxPayment: Maximum payment filter
- sortBy: Sort field (default: createdAt)
- sortOrder: asc/desc (default: desc)

**Example URL:**
```
GET /api/v1/tasks?page=1&limit=10&category=Plumbing&area=Colombo&minPayment=50&maxPayment=200
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ec49f1b2c8b1f8e4e1a2",
      "title": "Fix Kitchen Sink",
      "category": "Plumbing",
      "maxPayment": 100,
      "area": "Colombo",
      "customer": {
        "fullName": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### GET /api/v1/tasks/:id
**Description:** Get single task by ID  
**Access:** Public (for active tasks), Private (for other statuses)  

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a2",
    "title": "Fix Kitchen Sink",
    "description": "Need someone to fix a leaky kitchen sink...",
    "status": "active",
    "customer": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+94771234567"
    },
    "selectedTasker": null,
    "applicationCount": 3
  }
}
```

### GET /api/v1/tasks/customer/:customerId
**Description:** Get all tasks posted by a specific customer  
**Access:** Public  

**URL Parameters:**
- customerId: The ID of the customer whose tasks you want to retrieve

**Query Parameters:**
- status: Filter by task status (optional)
- page: Page number for pagination (default: 1)
- limit: Number of tasks per page (default: 10)

**Example URL:**
```
GET /api/v1/tasks/customer/60d5ec49f1b2c8b1f8e4e1a1?status=active&page=1&limit=5
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ec49f1b2c8b1f8e4e1a2",
      "title": "Fix Kitchen Sink",
      "category": "Plumbing",
      "status": "active",
      "minPayment": 50,
      "maxPayment": 100,
      "area": "Colombo",
      "startDate": "2024-02-01T09:00:00.000Z",
      "customer": {
        "_id": "60d5ec49f1b2c8b1f8e4e1a1",
        "fullName": "John Doe",
        "email": "john@example.com",
        "rating": {
          "average": 4.5,
          "count": 10
        },
        "statistics": {
          "tasksPosted": 15,
          "tasksCompleted": 12
        }
      },
      "selectedTasker": null,
      "applicationCount": 3,
      "createdAt": "2024-01-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "pages": 2
  },
  "customer": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a1",
    "fullName": "John Doe",
    "email": "john@example.com",
    "rating": {
      "average": 4.5,
      "count": 10
    },
    "statistics": {
      "tasksPosted": 15,
      "tasksCompleted": 12
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Customer not found"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid customer ID"
}
```

### GET /api/v1/tasks/user/my-tasks
**Description:** Get current user's tasks  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

**Query Parameters:**
- status: Filter by status (optional)

### GET /api/v1/tasks/user/my-applications
**Description:** Get current user's task applications  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

**Query Parameters:**
- status: Filter by status (optional)

---

## 3. Task Application Endpoints

### POST /api/v1/tasks/:id/apply
**Description:** Apply for a task  
**Access:** Private (Tasker only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "proposedPayment": 75,
  "note": "I have 5 years of plumbing experience and can fix this quickly."
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a3",
    "task": "60d5ec49f1b2c8b1f8e4e1a2",
    "tasker": "60d5ec49f1b2c8b1f8e4e1a5",
    "proposedPayment": 75,
    "note": "I have 5 years of plumbing experience...",
    "status": "pending"
  }
}
```

### GET /api/v1/tasks/:id/applications
**Description:** Get applications for a task  
**Access:** Private (Task owner only)  
**Headers:** Authorization: Bearer <jwt_token>  

**Query Parameters:**
- status: Filter by application status (optional)

### POST /api/v1/tasks/:id/select-tasker
**Description:** Select a tasker for the task with agreed time and payment  
**Access:** Private (Customer only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "taskerId": "60d5ec49f1b2c8b1f8e4e1a3",
  "agreedTime": "2024-01-15T10:00:00.000Z",
  "agreedPayment": 75
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Tasker selected successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a2",
    "title": "Fix Kitchen Sink",
    "description": "Kitchen sink is leaking and needs repair",
    "status": "scheduled",
    "selectedTasker": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a3",
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+94771234568",
      "taskerProfile": {
        "skills": ["Plumbing", "Electrical"],
        "area": "Colombo"
      },
      "rating": {
        "average": 4.8,
        "count": 25
      },
      "statistics": {
        "completedTasks": 45,
        "totalEarnings": 15000
      }
    },
    "customer": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a1",
      "fullName": "John Doe",
      "email": "john@example.com"
    },
    "agreedPayment": 75,
    "agreedTime": "2024-01-15T10:00:00.000Z",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "startDate": "2024-01-15T08:00:00.000Z",
    "endDate": "2024-01-15T18:00:00.000Z"
  }
}
```

**Validation Requirements:**
- All fields (taskerId, agreedTime, agreedPayment) are required
- taskerId must be a valid ObjectId of an existing tasker
- agreedTime must be a valid ISO date string
- agreedTime must be within the task's startDate and endDate range
- agreedTime must be within the tasker's available time window
- Tasker must have a pending application for this task
- Tasker must have confirmed their availability (provided availableStartDate and availableEndDate)
- Only the task owner (customer) can select a tasker
- Task must be in a state that allows scheduling

**Error Responses:**
```json
{
  "success": false,
  "message": "All fields (taskerId, agreedTime, agreedPayment) are required"
}
```

```json
{
  "success": false,
  "message": "Tasker has not confirmed their availability"
}
```

```json
{
  "success": false,
  "message": "Agreed time must be within tasker's available time range"
}
```

### POST /api/v1/tasks/:id/confirm-time
**Description:** Confirm availability time and payment for a task application  
**Access:** Private (Tasker only - must have applied)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "confirmedTime": "2024-01-15T10:00:00.000Z",
  "confirmedPayment": 100
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Availability confirmed successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a3",
    "task": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a2",
      "title": "Fix Kitchen Sink",
      "category": "Plumbing",
      "area": "Colombo",
      "startDate": "2024-01-15T08:00:00.000Z",
      "endDate": "2024-01-15T18:00:00.000Z",
      "minPayment": 50,
      "maxPayment": 150
    },
    "tasker": {
      "_id": "60d5ec49f1b2c8b1f8e4e1a4",
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+94771234568"
    },
    "proposedPayment": 80,
    "note": "I have experience with similar plumbing issues",
    "status": "pending",
    "confirmedByTasker": true,
    "confirmedTime": "2024-01-15T10:00:00.000Z",
    "confirmedPayment": 100,
    "availableStartDate": "2024-01-15T09:00:00.000Z",
    "availableEndDate": "2024-01-15T17:00:00.000Z",
    "createdAt": "2024-01-10T08:00:00.000Z"
  }
}
```

**Validation Requirements:**
- Only taskers who have applied to the task can confirm availability
- Task must be in 'active' status
- confirmedTime must be a valid ISO date string in the future
- confirmedTime must be within the task's startDate and endDate range
- confirmedPayment must be a positive number within task's min/max payment range
- Application must be in 'pending' status and not already confirmed

**Error Responses:**
```json
{
  "success": false,
  "message": "Only taskers can confirm their availability"
}
```

```json
{
  "success": false,
  "message": "Confirmed time must be in the future"
}
```

```json
{
  "success": false,
  "message": "Confirmed payment must be between $50 and $150"
}
```

```json
{
  "success": false,
  "message": "You have not applied for this task"
}
```

---

## 4. Task Workflow Endpoints

### POST /api/v1/tasks/:id/confirm-schedule
**Description:** Confirm task schedule  
**Access:** Private (Selected tasker only)  
**Headers:** Authorization: Bearer <jwt_token>  

### POST /api/v1/tasks/:id/tasker-complete
**Description:** Mark task as complete (tasker side)  
**Access:** Private (Selected tasker only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "completionNotes": "Task completed successfully. Sink is now working properly.",
  "completionPhotos": ["https://example.com/after-photo.jpg"]
}
```

### POST /api/v1/tasks/:id/complete
**Description:** Complete task with rating and review  
**Access:** Private (Customer only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent work! Very professional and completed the task quickly."
}
```

---

## 5. Feedback System Endpoints

### POST /api/v1/feedback
**Description:** Create feedback for a completed task  
**Access:** Private (Task participants only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body (Customer rating Tasker):**
```json
{
  "taskId": "60d5ec49f1b2c8b1f8e4e1a2",
  "toUserId": "60d5ec49f1b2c8b1f8e4e1a3",
  "rating": 5,
  "review": "Excellent work! Very professional and completed the task efficiently.",
  "feedbackType": "customer-to-tasker",
  "taskerFeedbackCategories": {
    "quality": 5,
    "punctuality": 5,
    "communication": 4,
    "professionalism": 5
  }
}
```

**Request Body (Tasker rating Customer):**
```json
{
  "taskId": "60d5ec49f1b2c8b1f8e4e1a2",
  "toUserId": "60d5ec49f1b2c8b1f8e4e1a1",
  "rating": 4,
  "review": "Good customer to work with. Clear instructions and prompt payment.",
  "feedbackType": "tasker-to-customer",
  "customerFeedbackCategories": {
    "clarity": 4,
    "responsiveness": 4,
    "cooperation": 5,
    "fairness": 4
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Feedback created successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a4",
    "rating": 5,
    "review": "Excellent work! Very professional...",
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
      "title": "Fix Kitchen Sink",
      "category": "Plumbing"
    },
    "taskerFeedbackCategories": {
      "quality": 5,
      "punctuality": 5,
      "communication": 4,
      "professionalism": 5
    },
    "createdAt": "2024-01-20T15:30:00.000Z"
  }
}
```

### GET /api/v1/feedback/user/:userId
**Description:** Get feedback received by a user  
**Access:** Public  

**Query Parameters:**
- type: Filter by feedback type ('customer-to-tasker' or 'tasker-to-customer')
- page: Page number (default: 1)
- limit: Items per page (default: 10)

**Example URL:**
```
GET /api/v1/feedback/user/60d5ec49f1b2c8b1f8e4e1a3?type=customer-to-tasker&page=1&limit=5
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "feedbacks": [
      {
        "_id": "60d5ec49f1b2c8b1f8e4e1a4",
        "rating": 5,
        "review": "Excellent service!",
        "feedbackType": "customer-to-tasker",
        "fromUser": {
          "fullName": "John Doe",
          "role": "customer"
        },
        "task": {
          "title": "Fix Kitchen Sink",
          "category": "Plumbing"
        },
        "taskerFeedbackCategories": {
          "quality": 5,
          "punctuality": 5,
          "communication": 4,
          "professionalism": 5
        },
        "helpfulVotes": 3,
        "createdAt": "2024-01-20T15:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 15
    }
  }
}
```

### GET /api/v1/feedback/rating-summary/:userId
**Description:** Get comprehensive rating summary and statistics for a user  
**Access:** Public  

**Success Response (200):**
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
        "_id": "60d5ec49f1b2c8b1f8e4e1a4",
        "rating": 5,
        "review": "Outstanding work!",
        "fromUser": {
          "fullName": "Alice Johnson",
          "role": "customer"
        },
        "createdAt": "2024-01-20T15:30:00.000Z"
      }
    ]
  }
}
```

### POST /api/v1/feedback/:feedbackId/response
**Description:** Add a response to received feedback  
**Access:** Private (Feedback recipient only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "response": "Thank you for the positive feedback! It was a pleasure working with you."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Response added successfully",
  "data": {
    "_id": "60d5ec49f1b2c8b1f8e4e1a4",
    "response": {
      "text": "Thank you for the positive feedback!...",
      "createdAt": "2024-01-20T16:00:00.000Z"
    }
  }
}
```

### POST /api/v1/feedback/:feedbackId/helpful
**Description:** Vote a feedback as helpful  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

**Success Response (200):**
```json
{
  "success": true,
  "message": "Feedback marked as helpful",
  "data": {
    "helpfulVotes": 4
  }
}
```

### POST /api/v1/feedback/:feedbackId/report
**Description:** Report inappropriate feedback  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "reason": "inappropriate"
}
```

**Available reasons:** inappropriate, fake, spam, offensive

**Success Response (200):**
```json
{
  "success": true,
  "message": "Feedback reported successfully"
}
```

---

## 6. Job Requests (Legacy) Endpoints

### POST /api/jobs
**Description:** Create a new job request  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

### GET /api/jobs
**Description:** Get all job requests  
**Access:** Public  

### GET /api/jobs/:id
**Description:** Get single job request by ID  
**Access:** Public  

### PUT /api/jobs/:id
**Description:** Update job request  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

### DELETE /api/jobs/:id
**Description:** Delete job request  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

---

## 7. User Management Endpoints

### POST /api/users/register
**Description:** Register user (Legacy endpoint)  
**Access:** Public  
**Headers:** Content-Type: application/json  

### POST /api/users/login
**Description:** Login user (Legacy endpoint)  
**Access:** Public  
**Headers:** Content-Type: application/json  

### GET /api/users/profile
**Description:** Get current user profile  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

---

## 8. Statistics Endpoints

### GET /api/stats/dashboard
**Description:** Get dashboard statistics  
**Access:** Public  

**Success Response (200):**
```json
{
  "totalUsers": 150,
  "totalTasks": 75,
  "completedTasks": 45,
  "activeTasks": 20,
  "totalTaskers": 80,
  "totalCustomers": 70
}
```

---

## 9. Admin Endpoints

### GET /api/admin/users
**Description:** Get all users  
**Access:** Private (Admin only)  
**Headers:** Authorization: Bearer <jwt_token>  

### DELETE /api/admin/user/:id
**Description:** Delete user by ID  
**Access:** Private (Admin only)  
**Headers:** Authorization: Bearer <jwt_token>  

---

## 10. Tasker Management Endpoints

### GET /api/v1/taskers
**Description:** Get all taskers  
**Access:** Private  
**Headers:** Authorization: Bearer <jwt_token>  

### PUT /api/v1/taskers/availability
**Description:** Update tasker availability  
**Access:** Private (Tasker only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "isAvailable": true,
  "availableHours": {
    "start": "09:00",
    "end": "17:00"
  }
}
```

---

## 11. Chat Endpoints

### POST /api/v1/chat
**Description:** Send a new chat message for a specific task  
**Access:** Private (authenticated users only)  
**Headers:** Authorization: Bearer <jwt_token>, Content-Type: application/json  

**Request Body:**
```json
{
  "taskId": "ObjectId",
  "senderId": "ObjectId",
  "receiverId": "ObjectId",
  "message": "Hello, I'm interested in this task"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "ObjectId",
    "taskId": {
      "_id": "ObjectId",
      "title": "Task Title"
    },
    "senderId": {
      "_id": "ObjectId",
      "fullName": "Sender Name",
      "email": "sender@email.com"
    },
    "receiverId": {
      "_id": "ObjectId",
      "fullName": "Receiver Name",
      "email": "receiver@email.com"
    },
    "message": "Hello, I'm interested in this task",
    "isRead": false,
    "messageType": "text",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/v1/chat/:taskId/:userId
**Description:** Fetch all messages between the logged-in user and specified user for a task  
**Access:** Private (only task participants can access)  
**Headers:** Authorization: Bearer <jwt_token>  

**Query Parameters:**
- page: Page number (default: 1)
- limit: Messages per page (default: 50)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "taskId": "ObjectId",
      "senderId": {
        "_id": "ObjectId",
        "fullName": "Sender Name",
        "email": "sender@email.com"
      },
      "receiverId": {
        "_id": "ObjectId",
        "fullName": "Receiver Name",
        "email": "receiver@email.com"
      },
      "message": "Hello, I'm interested in this task",
      "isRead": true,
      "messageType": "text",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "pages": 1
  },
  "task": {
    "_id": "ObjectId",
    "title": "Task Title",
    "status": "open"
  }
}
```

### GET /api/v1/chat/unread-count
**Description:** Get the total number of unread messages for the authenticated user  
**Access:** Private (authenticated users only)  
**Headers:** Authorization: Bearer <jwt_token>  

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

### PUT /api/v1/chat/:taskId/mark-read
**Description:** Mark all unread messages as read for a specific task  
**Access:** Private (authenticated users only)  
**Headers:** Authorization: Bearer <jwt_token>  

**Success Response (200):**
```json
{
  "success": true,
  "message": "Messages marked as read",
  "data": {
    "modifiedCount": 3
  }
}
```

---

## Task Access Control and Visibility Rules

### Task Status-Based Access Control

The TaskGo API implements strict access control based on task status to ensure privacy and security:

#### Active Tasks (`status: 'active'`)
- **Public Visibility**: Visible to all users in task listings
- **Task Details**: Accessible to everyone (no authentication required)
- **Applications**: Taskers can apply for the task
- **Chat Access**: Customer and applied taskers can communicate

#### Scheduled Tasks (`status: 'scheduled'`)
- **Public Visibility**: Hidden from all public task listings
- **Task Details**: Only accessible to customer and selectedTasker
- **Applications**: Blocked - no one can apply
- **Chat Access**: Only customer and selectedTasker can communicate
- **Privacy**: Completely invisible to other users

#### Other Statuses (`completed`, `cancelled`, etc.)
- **Public Visibility**: Hidden from public listings
- **Task Details**: Only accessible to customer and selectedTasker
- **Applications**: Only customer and selectedTasker can view
- **Chat Access**: Limited to customer and selectedTasker

### Access Control Matrix

| Task Status | Public List | Task Details | Applications | Chat Access |
|-------------|-------------|--------------|--------------|-------------|
| `active`    | ✅ Visible  | 🌐 Public    | ✅ Allowed   | 👥 Applied Users |
| `scheduled` | ❌ Hidden   | 🔒 Private   | ❌ Blocked   | 🔒 Participants Only |
| `completed` | ❌ Hidden   | 🔒 Private   | ❌ Blocked   | 🔒 Participants Only |
| `cancelled` | ❌ Hidden   | 🔒 Private   | ❌ Blocked   | 🔒 Participants Only |

### Security Features

- **Privacy Protection**: Scheduled tasks are completely hidden from unauthorized users
- **Data Isolation**: Users can only access tasks they are directly involved in
- **Communication Security**: Chat is restricted based on task status and user involvement
- **Application Control**: Prevents applications to unavailable tasks

### Error Responses for Access Control

**401 Unauthorized (Scheduled tasks without authentication):**
```json
{
  "success": false,
  "message": "Authentication required to view this task"
}
```

**403 Forbidden (Unauthorized access to scheduled tasks):**
```json
{
  "success": false,
  "message": "Access denied. Only the customer and selected tasker can view scheduled tasks."
}
```

**403 Forbidden (Application to non-active task):**
```json
{
  "success": false,
  "message": "This task is not available for applications"
}
```

**403 Forbidden (Chat access to scheduled tasks):**
```json
{
  "success": false,
  "message": "Only the customer and selected tasker can chat about scheduled tasks"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Email is required", "Password must be at least 8 characters"]
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

**Chat-specific 400 errors:**
```json
{
  "success": false,
  "message": "All fields (taskId, senderId, receiverId, message) are required"
}
```

```json
{
  "success": false,
  "message": "Invalid ID format"
}
```

```json
{
  "success": false,
  "message": "Receiver is not involved in this task"
}
```

```json
{
  "success": false,
  "message": "The specified user is not involved in this task"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied"
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

**Chat-specific 403 errors:**
```json
{
  "success": false,
  "message": "You can only send messages as yourself"
}
```

```json
{
  "success": false,
  "message": "You can only chat about tasks you are involved in"
}
```

```json
{
  "success": false,
  "message": "You can only view conversations for tasks you are involved in"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Task not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error while processing request"
}
```

---

## Environment Variables for Postman

Create these environment variables in Postman:

- `base_url`: http://localhost:5000
- `jwt_token`: (will be set automatically after login)

## Notes

1. **Authentication**: Most endpoints require JWT token except public ones
2. **File Uploads**: Use multipart/form-data for endpoints with file uploads
3. **Pagination**: Use page and limit query parameters for paginated endpoints
4. **Filtering**: Most GET endpoints support filtering via query parameters
5. **Error Handling**: All endpoints return consistent error response format
6. **Rate Limiting**: Login endpoint has rate limiting (5 attempts per 15 minutes)
7. **Feedback System**: 
   - Bidirectional rating system (customers ↔ taskers)
   - Category-based ratings for detailed evaluation
   - Only task participants can create feedback
   - Feedback can only be given for completed tasks
   - Comprehensive user statistics and rating analytics
8. **Enhanced User Data**: All user-related endpoints now return detailed statistics including:
   - Task completion counts and rates
   - Financial tracking (earnings/spending)
   - Rating breakdowns and distributions
   - Performance metrics
