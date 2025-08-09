const express = require('express');
const path = require('path');
const app = express();

// Test static files
app.use(express.static('public'));

// Test root route
app.get('/', (req, res) => {
    console.log('ROOT route hit - serving landing page');
    const filePath = path.join(__dirname, 'public', 'landing.html');
    console.log('File path:', filePath);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving file:', err);
            res.status(500).send('Error loading landing page');
        } else {
            console.log('Landing page served successfully');
        }
    });
});

// Test route to verify server is working
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
    console.log(`Test endpoint: http://localhost:${PORT}/test`);
    console.log(`Landing page: http://localhost:${PORT}`);
});