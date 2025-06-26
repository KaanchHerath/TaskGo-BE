# Targeted Tasks Feature

## Overview
The Targeted Tasks feature allows customers to send tasks directly to specific taskers. These tasks are only visible to the targeted tasker, creating a private hiring channel.

## How It Works

### 1. Customer Workflow
1. **Browse Taskers**: Customer visits `/taskers` page to view available taskers
2. **View Profile**: Click on a tasker to view their detailed profile at `/taskers/:id`
3. **Hire Directly**: Click "Hire This Tasker" button to open the targeted task modal
4. **Create Task**: Fill out the task details form and submit
5. **Private Task**: Task is sent directly to the selected tasker only

### 2. Tasker Workflow
1. **View Tasks**: Targeted tasks appear in their task feed alongside public tasks
2. **Apply**: Tasker can apply to the targeted task like any other task
3. **Chat & Schedule**: Same flow as regular tasks - chat, agree on time/payment
4. **Complete**: Standard task completion process

### 3. Task Visibility Rules
- **Public Tasks** (`isTargeted: false`): Visible to all taskers
- **Targeted Tasks** (`isTargeted: true`): Only visible to the specific `targetedTasker`
- **Customers**: Can only see their own tasks (both public and targeted)

## Database Schema Changes

### Task Model Updates
```javascript
// New fields added to Task schema
targetedTasker: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
isTargeted: {
  type: Boolean,
  default: false
}

// New indexes
taskSchema.index({ targetedTasker: 1, status: 1 });
taskSchema.index({ isTargeted: 1, status: 1 });
```

## API Changes

### Task Creation
- **Endpoint**: `POST /api/v1/tasks`
- **New Fields**:
  - `targetedTasker`: ObjectId of the tasker (optional)
  - `isTargeted`: Boolean (automatically set when targetedTasker is provided)

### Task Retrieval
- **Endpoint**: `GET /api/v1/tasks`
- **Updated Logic**: Filters tasks based on user role and targeted status
  - Taskers see: public tasks + tasks targeted to them
  - Others see: only public tasks

## Frontend Components

### New Components
1. **HireTaskerModal**: Modal for creating targeted tasks
2. **TaskerProfile**: Enhanced public tasker profile page

### Updated Components
1. **TaskerCard**: Added "Hire Now" button functionality
2. **App.jsx**: Added route for `/taskers/:id`

## Migration
Run the migration script to update existing tasks:
```bash
node migration-targeted-tasks.js
```

## Usage Examples

### Creating a Targeted Task
```javascript
import { createTargetedTask } from '../services/api/taskService';

const taskData = {
  title: "Fix Kitchen Sink",
  category: "Plumbing",
  description: "Kitchen sink is leaking...",
  minPayment: 2000,
  maxPayment: 4000,
  area: "Colombo",
  startDate: "2024-01-15T09:00:00.000Z",
  endDate: "2024-01-15T17:00:00.000Z"
};

await createTargetedTask(taskData, "taskerId123");
```

### Task Visibility Query
```javascript
// In getTasks controller
if (req.user && req.user.role === 'tasker') {
  // Show public tasks OR tasks targeted to this tasker
  query.$or = [
    { isTargeted: false },
    { isTargeted: true, targetedTasker: req.user._id }
  ];
} else {
  // Only show public tasks
  query.isTargeted = false;
}
```

## Benefits

1. **Direct Hiring**: Customers can hire specific taskers they trust
2. **Privacy**: Targeted tasks aren't visible to other taskers
3. **Efficiency**: Reduces competition and speeds up the hiring process
4. **Relationship Building**: Enables repeat customer-tasker relationships
5. **Quality Control**: Customers can work with proven taskers

## Security Considerations

1. **Validation**: Targeted tasker must exist and be a valid tasker
2. **Access Control**: Only targeted tasker can see targeted tasks
3. **Privacy**: Task details remain private between customer and tasker
4. **Authentication**: Requires customer login to create targeted tasks

## Testing

### Test Cases
1. Create targeted task with valid tasker ID
2. Create targeted task with invalid tasker ID (should fail)
3. Verify task visibility for different user roles
4. Test task application and completion flow
5. Verify migration script updates existing tasks

### API Testing
```bash
# Create targeted task
POST /api/v1/tasks
{
  "title": "Test Task",
  "targetedTasker": "validTaskerId",
  ...
}

# Get tasks as tasker (should see targeted tasks)
GET /api/v1/tasks
Authorization: Bearer <tasker-token>

# Get tasks as customer (should not see targeted tasks)
GET /api/v1/tasks
Authorization: Bearer <customer-token>
``` 