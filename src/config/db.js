import mongoose from "mongoose";


const connectDB = async () => {
    try {
        const options = {
            // Connection pooling options
            maxPoolSize: 10, 
            minPoolSize: 2,  
            // Timeout options
            serverSelectionTimeoutMS: 30000, 
            socketTimeoutMS: 45000, 
            connectTimeoutMS: 30000, 
            // Retry options
            retryWrites: true,
            retryReads: true,
            // Heartbeat options
            heartbeatFrequencyMS: 10000,
            // Buffer options 
            bufferCommands: false, 
        };

        await mongoose.connect(process.env.MONGO_URI, options);
        console.log("MongoDB Connected Successfully");
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`, error);
        
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI environment variable is not set!');
            console.error('Please set the MONGO_URI environment variable in your deployment platform.');
            console.error('See RENDER_ENVIRONMENT_SETUP.md for detailed instructions.');
        } else {
            console.error('Connection string (masked):', 
                process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        }
        
        process.exit(1);
    }
};

export default connectDB;
