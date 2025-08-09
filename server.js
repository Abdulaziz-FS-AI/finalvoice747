const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { requireAuth } = require('./middleware/auth.middleware');

// Import API routes
const assistantRoutes = require('./api/assistants');
const phoneNumberRoutes = require('./api/phone-numbers');
const callLogRoutes = require('./api/call-logs');
const analyticsRoutes = require('./api/analytics');
const vapiWebhookRoutes = require('./api/webhooks/vapi');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// Serve landing page at root for new visitors
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Direct dashboard access
app.get('/dashboard', (req, res) => {
    res.redirect('/dashboard.html');
});

// API Routes (protected by auth)
app.use('/api/assistants', assistantRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/analytics', analyticsRoutes);

// Webhook routes (no auth - validated by VAPI)
app.use('/api/webhooks/vapi', vapiWebhookRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Landing page: http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`Auth/Sign-up: http://localhost:${PORT}/auth.html`);
    console.log(`Create assistant: http://localhost:${PORT}/index.html`);
    console.log(`Manage assistants: http://localhost:${PORT}/assistants.html`);
    console.log(`Phone numbers: http://localhost:${PORT}/phone-numbers.html`);
    console.log(`Analytics: http://localhost:${PORT}/analytics.html`);
});