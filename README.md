# TaskGo Backend API

TaskGo is an on-demand gig worker platform that connects customers with skilled local service providers in real-time. This backend API ensures seamless service matching, secure transactions, and flexible scheduling, making everyday tasks effortless.


## 🛠️ Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer middleware
- **Real-time**: Socket.io for WebSocket connections
- **Validation**: Custom validation middleware
- **Testing**: Jest with Supertest
- **Payment**: PayHere integration
- **Security**: bcrypt, helmet, rate limiting

## 📋 Prerequisites

Before running this project, ensure you have:
- Node.js (version 18 or higher)
- MongoDB (version 5.0 or higher)
- npm or yarn package manager
- Git for version control
- PayHere Merchant Account (for payment functionality)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TaskGo-BE
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development


# PayHere Configuration
PAYHERE_MERCHANT_ID=your_merchant_id
PAYHERE_SECRET=your_secret_key
PAYHERE_SANDBOX=true

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 🔧 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon


## 📁 Project Structure

```
TaskGo-BE/
├── src/
│   ├── config/          # Database and app configuration
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── uploads/             # File uploads directory
├── tests/               # Test files
├── docs/                # Documentation
└── package.json
```

## 🔐 Authentication & Authorization

### Role-Based Access Control
- **Customer**: Can create tasks, hire taskers, manage payments
- **Tasker**: Can apply for tasks, update task status, communicate with customers
- **Admin**: Full platform access, user management, analytics

## 🌐 API Endpoints

### Authentication Routes
- `POST /api/auth/register-customer` - Customer registration
- `POST /api/auth/register-tasker` - Tasker registration with documents
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Task Management
- `GET /api/tasks` - Get all tasks with filters
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get specific task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/apply` - Apply for task

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get specific user (admin only)

### Payment Processing
- `POST /api/payments/initiate` - Start payment process
- `POST /api/payments/notify` - PayHere webhook handler
- `GET /api/payments/history` - Payment history

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - User management
- `PUT /api/admin/users/:id/approve` - Approve tasker
- `GET /api/admin/tasks` - Task oversight

## 💳 Payment Gateway Integration

### PayHere Setup
1. **Merchant Account**: Create account at [PayHere](https://www.payhere.lk/)
2. **API Credentials**: Get Merchant ID and Secret
3. **Webhook Configuration**: Set notify URL to your endpoint
4. **Environment Variables**: Update `.env` with credentials

### Payment Flow
1. Customer initiates payment
2. Backend creates PayHere payment request
3. Customer redirected to PayHere
4. PayHere sends notification to webhook
5. Backend updates payment status

### Webhook Security
- Verify PayHere signature
- Validate payment amount
- Update database transactionally

## 🔒 Security Features

### Input Validation
- **Sanitization**: XSS protection
- **Validation**: Custom validation middleware
- **File Upload**: Type and size restrictions

### Authentication Security
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure token storage

## 🗄️ Database Models

### User Schema
```javascript
{
  email: String,
  password: String,
  role: String,
  profile: Object,
  isApproved: Boolean,
  createdAt: Date
}
```

### Task Schema
```javascript
{
  title: String,
  description: String,
  category: String,
  budget: Number,
  location: Object,
  status: String,
  customerId: ObjectId,
  taskerId: ObjectId,
  createdAt: Date
}
```

## 🚀 Deployment

### Production Environment
- **Environment Variables**: Set production values
- **Database**: Use MongoDB Atlas or production MongoDB
- **File Storage**: Configure cloud storage (AWS S3, Google Cloud)
- **SSL**: Enable HTTPS with valid certificate
- **Monitoring**: Set up logging and monitoring

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taskgo
JWT_SECRET=production-jwt-secret
PAYHERE_SANDBOX=false
```

## 📊 Monitoring & Logging

### Health Checks
- `GET /api/health` - Server health status
- `GET /api/health/db` - Database connection status

## 🔧 Development Guidelines

### Code Style
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **Conventional Commits**: Git commit message format

### API Design Principles
- **RESTful**: Follow REST conventions
- **Versioning**: API versioning strategy
- **Error Handling**: Consistent error responses
- **Documentation**: OpenAPI/Swagger specs


## 🆘 Troubleshooting

### Common Issues
- **MongoDB Connection**: Check connection string and network
- **JWT Errors**: Verify secret and expiration
- **File Upload**: Check directory permissions
- **Payment Issues**: Verify PayHere credentials



## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -m 'Add feature'`
6. Push branch: `git push origin feature-name`
7. Submit pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical support:
- Check this documentation
- Review API endpoints
- Contact development team
- Check GitHub issues

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: TaskGo Development Team
