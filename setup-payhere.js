#!/usr/bin/env node

/**
 * PayHere Setup Script for TaskGo
 * This script helps you configure PayHere environment variables for Render deployment
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('🚀 PayHere Setup for TaskGo (Render Backend + ngrok Frontend)\n');

async function setupPayHere() {
  try {
    console.log('📋 Please provide the following information:\n');

    // Get Render backend URL
    const backendUrl = await question('Enter your Render backend URL (e.g., https://your-app.onrender.com): ');
    
    // Get ngrok frontend URL
    const frontendUrl = await question('Enter your ngrok frontend URL (e.g., https://abc123.ngrok.io): ');
    
    // Get PayHere credentials
    const merchantId = await question('Enter your PayHere Merchant ID: ');
    const merchantSecret = await question('Enter your PayHere Merchant Secret: ');
    
    // Get database and JWT info
    const mongoUri = await question('Enter your MongoDB connection string: ');
    const jwtSecret = await question('Enter your JWT secret key: ');

    // Generate environment variables
    const envContent = `# Database Configuration
MONGODB_URI=${mongoUri}
JWT_SECRET=${jwtSecret}
JWT_EXPIRE=30d
PORT=5000
NODE_ENV=production

# PayHere Configuration
PAYHERE_MERCHANT_ID=${merchantId}
PAYHERE_MERCHANT_SECRET=${merchantSecret}

# URL Configuration
BACKEND_URL=${backendUrl}
FRONTEND_URL=${frontendUrl}

# PayHere Webhook URLs
PAYHERE_NOTIFY_URL=${backendUrl}/api/payments/notify
PAYHERE_RETURN_URL=${frontendUrl}/payment/success
PAYHERE_CANCEL_URL=${frontendUrl}/payment/cancelled

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

    // Write to .env file
    const envPath = path.join(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Environment variables saved to .env file');
    console.log('\n📝 Next steps:');
    console.log('1. Copy these environment variables to your Render dashboard');
    console.log('2. Update your ngrok URL in Render when it changes');
    console.log('3. Configure PayHere webhooks with the URLs above');
    console.log('4. Test the payment system with sandbox credentials');

    console.log('\n🔗 PayHere Webhook URLs to configure:');
    console.log(`Notify URL: ${backendUrl}/api/payments/notify`);
    console.log(`Return URL: ${frontendUrl}/payment/success`);
    console.log(`Cancel URL: ${frontendUrl}/payment/cancelled`);

    console.log('\n⚠️  Important Notes:');
    console.log('- Update FRONTEND_URL in Render when ngrok URL changes');
    console.log('- Use PayHere sandbox for testing');
    console.log('- Monitor Render logs for payment notifications');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setupPayHere(); 