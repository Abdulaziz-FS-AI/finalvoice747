const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting Voice AI Assistant Server...');
console.log(`📍 Working directory: ${__dirname}`);
console.log(`🌐 Port: ${process.env.PORT || 8080}`);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Root route MUST come before static middleware to override index.html
app.get('/', (req, res) => {
    console.log('🏠 Serving landing page');
    res.sendFile(path.join(__dirname, 'public', 'landing.html'), (err) => {
        if (err) {
            console.error('❌ Error serving landing page:', err);
            res.status(500).send('Error loading landing page');
        }
    });
});

// Auth route
app.get('/auth', (req, res) => {
    console.log('🔐 Serving auth page');
    res.sendFile(path.join(__dirname, 'public', 'auth.html'), (err) => {
        if (err) {
            console.error('❌ Error serving auth page:', err);
            res.status(500).send('Error loading auth page');
        }
    });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    console.log('📊 Serving dashboard page');
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'), (err) => {
        if (err) {
            console.error('❌ Error serving dashboard page:', err);
            res.status(500).send('Error loading dashboard page');
        }
    });
});

// Assistants route
app.get('/assistants', (req, res) => {
    console.log('🤖 Serving assistants page');
    res.sendFile(path.join(__dirname, 'public', 'assistants.html'), (err) => {
        if (err) {
            console.error('❌ Error serving assistants page:', err);
            res.status(500).send('Error loading assistants page');
        }
    });
});

// Phone Numbers route
app.get('/phone-numbers', (req, res) => {
    console.log('📞 Serving phone numbers page');
    res.sendFile(path.join(__dirname, 'public', 'phone-numbers.html'), (err) => {
        if (err) {
            console.error('❌ Error serving phone numbers page:', err);
            res.status(500).send('Error loading phone numbers page');
        }
    });
});

// Analytics route
app.get('/analytics', (req, res) => {
    console.log('📈 Serving analytics page');
    res.sendFile(path.join(__dirname, 'public', 'analytics.html'), (err) => {
        if (err) {
            console.error('❌ Error serving analytics page:', err);
            res.status(500).send('Error loading analytics page');
        }
    });
});

// Create Assistant route (index.html)
app.get('/create-assistant', (req, res) => {
    console.log('➕ Serving assistant creation page');
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('❌ Error serving assistant creation page:', err);
            res.status(500).send('Error loading assistant creation page');
        }
    });
});

app.use(express.static('public'));

console.log('✅ Basic middleware configured');

// Auth config endpoint (for frontend)
app.get('/api/config/auth', (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
        return res.status(503).json({
            error: 'Supabase not configured',
            message: 'Please set up Supabase credentials in .env file'
        });
    }
    
    res.json({
        supabaseUrl: supabaseUrl,
        supabaseAnonKey: supabaseAnonKey
    });
});

// Voice options endpoint (public)
app.get('/api/config/voices', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: "Elliot", name: "Elliot", description: "Male, Canadian" },
            { id: "Kylie", name: "Kylie", description: "Female, Australian" },
            { id: "Rohan", name: "Rohan", description: "Male, Indian" },
            { id: "Lily", name: "Lily", description: "Female, British" },
            { id: "Savannah", name: "Savannah", description: "Female, American" },
            { id: "Hana", name: "Hana", description: "Female, Korean" },
            { id: "Neha", name: "Neha", description: "Female, Indian" },
            { id: "Cole", name: "Cole", description: "Male, American" },
            { id: "Harry", name: "Harry", description: "Male, British" },
            { id: "Paige", name: "Paige", description: "Female, American" },
            { id: "Spencer", name: "Spencer", description: "Male, American" }
        ]
    });
});

console.log('✅ Config endpoints registered');

// Try to import API routes with error handling
let apiRoutesLoaded = 0;

try {
    const assistantRoutes = require('./api/assistants');
    app.use('/api/assistants', assistantRoutes);
    apiRoutesLoaded++;
    console.log('✅ Assistant routes loaded');
} catch (err) {
    console.warn('⚠️ Could not load assistant routes:', err.message);
}

try {
    const phoneNumberRoutes = require('./api/phone-numbers');
    app.use('/api/phone-numbers', phoneNumberRoutes);
    apiRoutesLoaded++;
    console.log('✅ Phone number routes loaded');
} catch (err) {
    console.warn('⚠️ Could not load phone number routes:', err.message);
}

try {
    const callLogRoutes = require('./api/call-logs');
    app.use('/api/call-logs', callLogRoutes);
    apiRoutesLoaded++;
    console.log('✅ Call log routes loaded');
} catch (err) {
    console.warn('⚠️ Could not load call log routes:', err.message);
}

try {
    const analyticsRoutes = require('./api/analytics');
    app.use('/api/analytics', analyticsRoutes);
    apiRoutesLoaded++;
    console.log('✅ Analytics routes loaded');
} catch (err) {
    console.warn('⚠️ Could not load analytics routes:', err.message);
}

try {
    const vapiWebhookRoutes = require('./api/webhooks/vapi');
    app.use('/api/webhooks/vapi', vapiWebhookRoutes);
    apiRoutesLoaded++;
    console.log('✅ VAPI webhook routes loaded');
} catch (err) {
    console.warn('⚠️ Could not load VAPI webhook routes:', err.message);
}

console.log(`📊 Loaded ${apiRoutesLoaded}/5 API route modules`);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        apiRoutes: apiRoutesLoaded 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server with proper error handling
console.log(`🚀 Attempting to start server on port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🎉 =================================');
    console.log('✅ Voice AI Assistant Server Running!');
    console.log('🎉 =================================');
    console.log(`🌐 Landing Page: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🔐 Authentication: http://localhost:${PORT}/auth.html`);
    console.log(`🤖 Create Assistant: http://localhost:${PORT}/index.html`);
    console.log(`📞 Phone Numbers: http://localhost:${PORT}/phone-numbers.html`);
    console.log(`📈 Analytics: http://localhost:${PORT}/analytics.html`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
    console.log('🎉 =================================\n');
});

server.on('error', (err) => {
    console.error('💥 Server failed to start:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
        console.error('💡 Try: pkill -f node or use a different port');
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection:', err);
    process.exit(1);
});