# Task Model Updates and ChatMessage Model

## Overview
This update enhances the Task model with additional scheduling fields and introduces a new ChatMessage model for task-related communication between customers and taskers.

## Task Model Updates

### New Fields Added
- **`agreedTime`**: `Date` - The specific agreed-upon time for task execution
  - Must be between `startDate` and `endDate`
  - Required when task status is set to 'scheduled'
  - Allows null for non-scheduled tasks

### Existing Fields (Confirmed)
- **`selectedTasker`**: `ObjectId` (ref: User) - The chosen tasker for the task
- **`agreedPayment`**: `Number` - The final agreed payment amount
- **`status`**: `String` - Task status with enum values: `['active', 'scheduled', 'completed', 'cancelled']`

### Enhanced Validation
- When a task status is set to 'scheduled', the following fields are now required:
  - `selectedTasker`
  - `agreedPayment` 
  - `agreedTime`

### Usage Examples

```javascript
// Creating a scheduled task
const task = new Task({
  title: "Fix Kitchen Sink",
  // ... other required fields
  selectedTasker: new ObjectId("..."),
  agreedPayment: 150,
  agreedTime: new Date("2024-01-15T10:00:00Z"),
  status: 'scheduled'
});

// Updating task to scheduled status
task.status = 'scheduled';
task.selectedTasker = taskerId;
task.agreedPayment = 200;
task.agreedTime = new Date("2024-01-20T14:30:00Z");
await task.save(); // Will validate all required fields
```

## ChatMessage Model

### Schema Structure
```javascript
{
  _id: ObjectId,
  taskId: ObjectId (ref: Task, required),
  senderId: ObjectId (ref: User, required),
  receiverId: ObjectId (ref: User, required),
  message: String (required, max 1000 chars),
  isRead: Boolean (default: false),
  messageType: String (enum: ['text', 'system', 'payment_update', 'time_update'], default: 'text'),
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

### Key Features
- **Task-based messaging**: All messages are linked to a specific task
- **Read status tracking**: Track whether messages have been read
- **Message types**: Support for different types of messages (text, system notifications, updates)
- **Validation**: Ensures sender and receiver are different users
- **Performance optimized**: Multiple indexes for efficient querying

### Static Methods

#### `getConversation(taskId, userId1, userId2, limit)`
Get conversation between two users for a specific task.

```javascript
const messages = await ChatMessage.getConversation(taskId, customerId, taskerId, 50);
```

#### `getTaskConversations(taskId)`
Get all conversations for a specific task.

```javascript
const allMessages = await ChatMessage.getTaskConversations(taskId);
```

#### `markAsRead(taskId, receiverId)`
Mark all unread messages for a receiver in a task as read.

```javascript
await ChatMessage.markAsRead(taskId, userId);
```

#### `getUnreadCount(userId)`
Get count of unread messages for a user.

```javascript
const unreadCount = await ChatMessage.getUnreadCount(userId);
```

### Instance Methods

#### `markAsRead()`
Mark a specific message as read.

```javascript
await message.markAsRead();
```

### Usage Examples

```javascript
// Send a message
const message = new ChatMessage({
  taskId: task._id,
  senderId: customer._id,
  receiverId: tasker._id,
  message: "Hi! I'd like to discuss the task details.",
  messageType: 'text'
});
await message.save();

// Get conversation
const conversation = await ChatMessage.getConversation(
  taskId, 
  customerId, 
  taskerId, 
  50
);

// Mark messages as read
await ChatMessage.markAsRead(taskId, userId);

// Get unread count
const unreadCount = await ChatMessage.getUnreadCount(userId);
```

## Database Indexes

### Task Collection
- Existing indexes maintained
- New index added: `{ agreedTime: 1 }`

### ChatMessage Collection
- `{ taskId: 1, createdAt: -1 }` - For task-based message retrieval
- `{ senderId: 1, receiverId: 1 }` - For user-to-user conversations
- `{ taskId: 1, senderId: 1, receiverId: 1 }` - For specific task conversations
- `{ receiverId: 1, isRead: 1 }` - For unread message queries

## Migration

Run the migration script to update existing data:

```bash
node migration-add-chat-and-agreed-time.js
```

This will:
1. Add `agreedTime: null` to all existing tasks
2. Create the ChatMessage collection
3. Set up all necessary indexes
4. Provide a summary of changes

## API Integration

These models are ready for integration with:
- Chat/messaging endpoints
- Task scheduling workflows
- Real-time messaging (Socket.io)
- Notification systems
- Task management interfaces

## Security Considerations

- Messages are linked to specific tasks for context
- Sender/receiver validation prevents self-messaging
- Message length limits prevent spam
- Read status tracking for better UX
- Proper indexing for performance at scale 