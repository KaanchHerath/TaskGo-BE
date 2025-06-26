# TaskGo Feedback System Documentation

## Overview

The TaskGo platform now includes a comprehensive bidirectional feedback system that allows both customers and taskers to rate and review each other after task completion. This system provides detailed analytics, category-based ratings, and enhanced user statistics.

## Features

### 🔄 Bidirectional Feedback
- **Customer-to-Tasker**: Customers can rate taskers on quality, punctuality, communication, and professionalism
- **Tasker-to-Customer**: Taskers can rate customers on clarity, responsiveness, cooperation, and fairness

### ⭐ Enhanced Rating System
- **Overall Rating**: 1-5 star rating system
- **Category Ratings**: Detailed breakdown by specific attributes
- **Rating Distribution**: Track how many 1-star, 2-star, etc. ratings received
- **Average Calculations**: Automatic calculation of overall and category averages

### 📊 Advanced Statistics
- **Task Completion Tracking**: Number of tasks posted, completed, and in progress
- **Financial Tracking**: Total earnings (taskers) and spending (customers)
- **Performance Metrics**: Completion rates, response times, repeat customers
- **Rating Analytics**: Detailed rating breakdowns and trends

## Database Models

### Feedback Model (`/src/models/Feedback.js`)

```javascript
{
  task: ObjectId,              // Reference to the completed task
  fromUser: ObjectId,          // User giving the feedback
  toUser: ObjectId,            // User receiving the feedback
  rating: Number,              // Overall rating (1-5)
  review: String,              // Written review (10-1000 characters)
  feedbackType: String,        // 'customer-to-tasker' or 'tasker-to-customer'
  
  // Tasker-specific category ratings
  taskerFeedbackCategories: {
    quality: Number,           // Work quality rating
    punctuality: Number,       // Timeliness rating
    communication: Number,     // Communication skills rating
    professionalism: Number    // Professional behavior rating
  },
  
  // Customer-specific category ratings
  customerFeedbackCategories: {
    clarity: Number,           // Task description clarity
    responsiveness: Number,    // Response time to messages
    cooperation: Number,       // Cooperation during task
    fairness: Number          // Fair treatment and payment
  },
  
  isPublic: Boolean,          // Whether feedback is publicly visible
  response: {                 // Optional response from recipient
    text: String,
    createdAt: Date
  },
  helpfulVotes: Number,       // Community votes for helpful feedback
  reportedBy: [...]           // Abuse reporting system
}
```

### Enhanced User Model

```javascript
{
  // Enhanced rating system
  rating: {
    average: Number,           // Overall average rating
    count: Number,             // Total number of ratings
    total: Number,             // Sum of all ratings
    
    // Detailed category averages (for taskers)
    categoryAverages: {
      quality: Number,
      punctuality: Number,
      communication: Number,
      professionalism: Number
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
    tasksPosted: Number,       // Tasks posted (customers)
    tasksCompleted: Number,    // Tasks completed
    tasksAppliedTo: Number,    // Tasks applied to (taskers)
    tasksInProgress: Number,   // Currently active tasks
    totalEarnings: Number,     // Total money earned (taskers)
    totalSpent: Number,        // Total money spent (customers)
    responseTime: Number,      // Average response time in hours
    completionRate: Number,    // Percentage of completed vs started tasks
    repeatCustomers: Number    // Number of repeat customers
  }
}
```

## API Endpoints

### Feedback Management

#### Create Feedback
```http
POST /api/v1/feedback
Authorization: Bearer {token}
Content-Type: application/json

{
  "taskId": "task_object_id",
  "toUserId": "recipient_user_id",
  "rating": 5,
  "review": "Excellent work! Very professional and timely.",
  "feedbackType": "customer-to-tasker",
  "taskerFeedbackCategories": {
    "quality": 5,
    "punctuality": 5,
    "communication": 4,
    "professionalism": 5
  }
}
```

#### Get User Feedback
```http
GET /api/v1/feedback/user/{userId}?type=customer-to-tasker&page=1&limit=10
```

#### Get User Rating Summary
```http
GET /api/v1/feedback/rating-summary/{userId}
```

### Enhanced Task Endpoints

Task endpoints now return enhanced user information including:
- Detailed rating breakdowns
- Category averages for taskers
- Comprehensive statistics
- Task completion history

## Frontend Integration

### Updated Components

#### CustomerInfo Component
- Shows customer's posting history
- Displays customer rating from taskers
- Shows completion statistics

#### TaskerInfo Component (Recommended)
```jsx
const TaskerInfo = ({ tasker }) => {
  return (
    <div className="tasker-profile">
      <div className="rating-summary">
        <div className="overall-rating">
          <Stars rating={tasker.rating.average} />
          <span>{tasker.rating.average.toFixed(1)}/5</span>
          <span>({tasker.rating.count} reviews)</span>
        </div>
        
        <div className="category-ratings">
          <CategoryRating label="Quality" rating={tasker.rating.categoryAverages.quality} />
          <CategoryRating label="Punctuality" rating={tasker.rating.categoryAverages.punctuality} />
          <CategoryRating label="Communication" rating={tasker.rating.categoryAverages.communication} />
          <CategoryRating label="Professionalism" rating={tasker.rating.categoryAverages.professionalism} />
        </div>
      </div>
      
      <div className="statistics">
        <Stat label="Tasks Completed" value={tasker.statistics.tasksCompleted} />
        <Stat label="Completion Rate" value={`${tasker.statistics.completionRate}%`} />
        <Stat label="Response Time" value={`${tasker.statistics.responseTime}h`} />
      </div>
    </div>
  );
};
```

### Feedback Form Component
```jsx
const FeedbackForm = ({ task, recipientType, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [categoryRatings, setCategoryRatings] = useState({
    quality: 5,
    punctuality: 5,
    communication: 5,
    professionalism: 5
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const feedbackData = {
      taskId: task._id,
      toUserId: task.selectedTasker._id,
      rating,
      review,
      feedbackType: 'customer-to-tasker',
      taskerFeedbackCategories: categoryRatings
    };

    await createFeedback(feedbackData);
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <StarRating value={rating} onChange={setRating} />
      <CategoryRatings 
        categories={categoryRatings} 
        onChange={setCategoryRatings}
        type="tasker"
      />
      <textarea 
        value={review} 
        onChange={(e) => setReview(e.target.value)}
        placeholder="Share your experience..."
        minLength={10}
        maxLength={1000}
        required
      />
      <button type="submit">Submit Feedback</button>
    </form>
  );
};
```

## Migration

### Running the Migration

```bash
# Navigate to backend directory
cd TaskGo-BE

# Run the feedback system migration
node migration-feedback-system.js
```

### What the Migration Does

1. **Updates User Schema**: Adds new rating and statistics fields to all existing users
2. **Calculates Statistics**: Computes actual task counts, earnings, and completion rates
3. **Migrates Ratings**: Converts existing task ratings to the new feedback system
4. **Recalculates Averages**: Updates user rating averages based on migrated feedback

## Key Changes Made

### Backend Changes

1. **New Feedback Model** (`/src/models/Feedback.js`)
   - Comprehensive feedback system with bidirectional ratings
   - Category-based ratings for detailed evaluation
   - Abuse reporting and response system

2. **Enhanced User Model** (`/src/models/User.js`)
   - Detailed rating breakdowns and distributions
   - Comprehensive statistics tracking
   - Financial tracking (earnings/spending)
   - Performance metrics (completion rates, response times)

3. **Feedback Controller** (`/src/controllers/feedbackController.js`)
   - Create, retrieve, and manage feedback
   - User rating summaries and statistics
   - Access control and validation

4. **Feedback Routes** (`/src/routes/feedbackRoutes.js`)
   - RESTful API endpoints for feedback operations
   - Public and private access controls

5. **Migration Script** (`migration-feedback-system.js`)
   - Migrates existing data to new feedback system
   - Calculates actual statistics from historical data
   - Preserves existing ratings and reviews

### Frontend Changes

1. **Enhanced CustomerInfo Component**
   - Shows realistic task statistics
   - Displays customer ratings from taskers
   - Improved data presentation

2. **API Integration Ready**
   - Backend provides enhanced user data
   - Task endpoints include detailed statistics
   - Ready for feedback form implementation

## Next Steps for Full Implementation

### Frontend Components to Create

1. **FeedbackForm Component**
   - Star rating interface
   - Category rating sliders
   - Review text area
   - Validation and submission

2. **TaskerProfile Component**
   - Detailed rating display
   - Category breakdown visualization
   - Statistics dashboard
   - Recent feedback list

3. **FeedbackList Component**
   - Display user's received feedback
   - Pagination and filtering
   - Response functionality

4. **RatingDisplay Component**
   - Reusable star rating display
   - Category rating bars
   - Distribution charts

### Services to Implement

```javascript
// /src/services/api/feedbackService.js
export const createFeedback = async (feedbackData) => {
  const response = await axiosInstance.post('/v1/feedback', feedbackData);
  return response.data;
};

export const getUserFeedback = async (userId, type, page = 1) => {
  const response = await axiosInstance.get(`/v1/feedback/user/${userId}`, {
    params: { type, page }
  });
  return response.data;
};

export const getUserRatingSummary = async (userId) => {
  const response = await axiosInstance.get(`/v1/feedback/rating-summary/${userId}`);
  return response.data;
};
```

## Benefits of This Implementation

1. **Trust Building**: Bidirectional feedback builds trust between users
2. **Quality Assurance**: Category ratings help identify specific strengths/weaknesses
3. **Performance Tracking**: Comprehensive statistics help users improve
4. **Transparency**: Public ratings create accountability
5. **Data-Driven Decisions**: Rich analytics for platform optimization

The feedback system is now fully implemented on the backend with comprehensive data migration. The frontend can now integrate these new APIs to provide a rich feedback experience for users. 