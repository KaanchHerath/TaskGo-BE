import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Connection pooling options
            maxPoolSize: 10, // Maximum number of connections in the pool
            minPoolSize: 2,  // Minimum number of connections in the pool
            // Timeout options
            serverSelectionTimeoutMS: 30000, // Timeout for server selection
            socketTimeoutMS: 45000, // Timeout for socket operations
            connectTimeoutMS: 30000, // Timeout for initial connection
            // Retry options
            retryWrites: true,
            retryReads: true,
            // Heartbeat options
            heartbeatFrequencyMS: 10000,
            // Buffer options (updated for newer MongoDB versions)
            bufferCommands: false, // Disable mongoose buffering
        };

        await mongoose.connect(process.env.MONGO_URI, options);
        console.log("MongoDB Connected Successfully");
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        console.error('Connection string (masked):', process.env.MONGO_URI ? 
            process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'Not set');
        process.exit(1);
    }
};

export default connectDB;
