# Database Migration Instructions

## User Rating and Statistics Migration

This migration updates the User model to include rating and statistics fields, and updates existing data accordingly.

### What this migration does:

1. **Adds new fields to User model:**
   - `phone` - User phone number (now required)
   - `rating.average` - Average user rating (0-5)
   - `rating.count` - Number of ratings received
   - `rating.total` - Total rating points received
   - `statistics.tasksPosted` - Number of tasks posted (customers)
   - `statistics.tasksCompleted` - Number of tasks completed
   - `statistics.tasksAppliedTo` - Number of tasks applied to (taskers)

2. **Updates Task model:**
   - Adds `postedDate` virtual field (alias for `createdAt`)

3. **Updates existing data:**
   - Sets default values for all existing users
   - Adds default phone numbers to users who don't have them
   - Counts and updates actual statistics from existing tasks and applications

4. **Updates registration forms:**
   - Tasker registration now includes phone number field
   - Customer registration already had phone number field
   - All registration routes now properly validate and store phone numbers

### How to run the migration:

```bash
# Navigate to the backend directory
cd TaskGo-BE

# Run the main migration script (includes phone numbers)
node migration-update-users.js

# OR run phone number migration separately if needed
node migration-add-phone-numbers.js
```

### After migration:

1. **Task creation** now automatically increments customer's `tasksPosted` count
2. **Task application** now automatically increments tasker's `tasksAppliedTo` count  
3. **Task completion** now automatically:
   - Updates tasker's rating using the new rating system
   - Increments tasker's `tasksCompleted` count
   - Increments customer's `tasksCompleted` count

### API Changes:

- Task details now include customer rating and statistics
- User profiles now show accurate task counts and ratings
- All hardcoded data in the frontend has been replaced with dynamic data

### Frontend Updates:

- TaskDetails page now displays real customer data:
  - Actual customer name and initials
  - Real phone number and email
  - Actual posted tasks count
  - Real average rating
  - Dynamic customer information

### Note:

Make sure your MongoDB connection is properly configured in your `.env` file before running the migration. 