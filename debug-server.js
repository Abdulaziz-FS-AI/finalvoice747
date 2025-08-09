const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting debug server...');
console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV);

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('✅ Middleware configured');

// Test route
app.get('/debug', (req, res) => {
    console.log('🔍 Debug route hit');
    res.json({ 
        message: 'Debug server is working!', 
        timestamp: new Date().toISOString(),
        port: PORT 
    });
});

// Landing page route
app.get('/', (req, res) => {
    console.log('🏠 Landing page route hit');
    const filePath = path.join(__dirname, 'public', 'landing.html');
    console.log('📁 Attempting to serve file:', filePath);
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Error serving landing page:', err);
            res.status(500).send(`Error loading landing page: ${err.message}`);
        } else {
            console.log('✅ Landing page served successfully');
        }
    });
});

// Health check route
app.get('/health', (req, res) => {
    console.log('❤️ Health check hit');
    res.json({ status: 'OK', port: PORT });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
console.log(`🚀 Attempting to start server on port ${PORT}...`);

const server = app.listen(PORT, () => {
    console.log(`✅ Debug server running successfully!`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🔍 Debug endpoint: http://localhost:${PORT}/debug`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    console.log(`🏠 Landing page: http://localhost:${PORT}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
});

server.on('error', (err) => {
    console.error('💥 Server failed to start:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
    }
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err);
    process.exit(1);
});