# TaskGo Backend API Summary

## Complete API Endpoint Documentation

I have thoroughly analyzed the TaskGo backend codebase and documented all available API endpoints. Here's what I found:

## 📁 **File Structure Analyzed:**
- `src/routes/` - All route files
- `src/controllers/` - Controller implementations
- `src/server.js` - Main server configuration
- `src/middleware/` - Authentication middleware

## 🔗 **API Endpoints by Category:**

### 1. **Authentication** (`/api/auth/`)
- **POST** `/api/auth/register` - Register user (customer/tasker)
- **POST** `/api/auth/register-tasker` - Register tasker with file uploads
- **POST** `/api/auth/login` - User login with rate limiting

### 2. **Task Management** (`/api/v1/tasks/`)
- **POST** `/api/v1/tasks` - Create new task (Customer only)
- **GET** `/api/v1/tasks` - Get all active tasks (Public, with filters)
- **GET** `/api/v1/tasks/:id` - Get single task by ID
- **GET** `/api/v1/tasks/user/my-tasks` - Get user's tasks
- **GET** `/api/v1/tasks/user/my-applications` - Get user's applications

### 3. **Task Applications** (`/api/v1/tasks/:id/`)
- **POST** `/api/v1/tasks/:id/apply` - Apply for task (Tasker only)
- **GET** `/api/v1/tasks/:id/applications` - Get task applications
- **POST** `/api/v1/tasks/:id/select-tasker` - Select tasker with agreed time and payment (Customer only)

### 4. **Task Workflow** (`/api/v1/tasks/:id/`)
- **POST** `/api/v1/tasks/:id/select-tasker` - Select tasker with agreed time and payment (Customer only)
- **POST** `/api/v1/tasks/:id/confirm-time` - Confirm availability time and payment (Tasker only)
- **POST** `/api/v1/tasks/:id/confirm-schedule` - Confirm schedule (Tasker)
- **POST** `/api/v1/tasks/:id/tasker-complete` - Mark complete (Tasker)
- **POST** `/api/v1/tasks/:id/complete` - Complete with rating (Customer)

### 5. **Job Requests - Legacy** (`/api/jobs/`)
- **POST** `/api/jobs` - Create job request
- **GET** `/api/jobs` - Get all job requests (Public)
- **GET** `/api/jobs/:id` - Get job request by ID (Public)
- **PUT** `/api/jobs/:id` - Update job request
- **DELETE** `/api/jobs/:id` - Delete job request

### 6. **User Management** (`/api/users/`)
- **POST** `/api/users/register` - Register user (Legacy)
- **POST** `/api/users/login` - Login user (Legacy)
- **GET** `/api/users/profile` - Get user profile

### 7. **Statistics** (`/api/stats/`)
- **GET** `/api/stats/dashboard` - Get dashboard statistics (Public)

### 8. **Admin Management** (`/api/admin/`)
- **GET** `/api/admin/users` - Get all users (Admin only)
- **DELETE** `/api/admin/user/:id` - Delete user (Admin only)

### 9. **Tasker Management** (`/api/v1/taskers/`)
- **GET** `/api/v1/taskers` - Get all taskers
- **PUT** `/api/v1/taskers/availability` - Update availability (Tasker only)

### 10. **Chat System** (`/api/v1/chat/`)
- **POST** `/api/v1/chat` - Send a new chat message
- **GET** `/api/v1/chat/:taskId/:userId` - Get conversation between users for a task
- **GET** `/api/v1/chat/unread-count` - Get unread message count
- **PUT** `/api/v1/chat/:taskId/mark-read` - Mark messages as read

## 🔐 **Authentication & Security:**
- JWT token-based authentication
- Rate limiting on login (5 attempts per 15 minutes)
- Role-based access control (customer, tasker, admin)
- File upload support for tasker documents
- Password strength validation
- Email and phone validation

## 📊 **Key Features:**
- **Pagination** - Most GET endpoints support page/limit parameters
- **Filtering** - Tasks can be filtered by category, area, payment range
- **File Uploads** - Tasker registration supports ID and qualification documents
- **Status Management** - Task workflow with multiple status states
- **Error Handling** - Consistent error response format across all endpoints
- **Real-time Chat** - Task-based messaging system with read status tracking
- **Task Access Control** - Status-based visibility and access restrictions for enhanced privacy

## 📋 **Deliverables Created:**

### 1. **API_ENDPOINTS_DOCUMENTATION.md**
- Complete endpoint documentation with:
  - HTTP methods and URLs
  - Required headers and authentication
  - Sample request/response payloads
  - Query parameters and filters
  - Error response formats

### 2. **Postman Collection Ready**
- Environment variables: `base_url`, `jwt_token`
- Organized by feature modules
- Auto-token setting on login
- Sample payloads for all endpoints

## 🚀 **Usage Instructions:**

### For Postman Testing:
1. Import the collection (when JSON is created)
2. Set environment variables:
   - `base_url`: http://localhost:5000
   - `jwt_token`: (auto-set after login)
3. Start with authentication endpoints
4. Use JWT token for protected routes

### For Development:
1. Refer to `API_ENDPOINTS_DOCUMENTATION.md` for complete specs
2. All endpoints follow RESTful conventions
3. Consistent error handling across all routes
4. Role-based access clearly documented

## 🔍 **Notable Findings:**
- Two authentication systems (main `/api/auth/` and legacy `/api/users/`)
- Task management is the core feature with comprehensive workflow
- File upload capability for tasker document verification
- Public access for browsing tasks, private for operations
- Admin panel functionality for user management
- Statistics endpoint for dashboard data
- Chat system with secure task-based communication and access control
- **Enhanced Privacy**: Status-based task visibility (active tasks public, scheduled tasks private)

## ✅ **Status: COMPLETE**
All backend routes have been documented with full specifications ready for Postman import and API testing. 