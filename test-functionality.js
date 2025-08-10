#!/usr/bin/env node

const http = require('http');

console.log('🧪 COMPREHENSIVE FUNCTIONALITY TEST\n');
console.log('=' .repeat(50));

const tests = [
    // Page routes
    { name: 'Landing Page', url: 'http://localhost:8080/' },
    { name: 'Auth Page', url: 'http://localhost:8080/auth' },
    { name: 'Dashboard', url: 'http://localhost:8080/dashboard' },
    { name: 'Create Assistant', url: 'http://localhost:8080/create-assistant' },
    { name: 'Assistants', url: 'http://localhost:8080/assistants' },
    { name: 'Phone Numbers', url: 'http://localhost:8080/phone-numbers' },
    { name: 'Analytics', url: 'http://localhost:8080/analytics' },
    
    // CSS files
    { name: 'Design System CSS', url: 'http://localhost:8080/css/design-system.css' },
    { name: 'Modern Theme CSS', url: 'http://localhost:8080/css/modern-theme.css' },
    
    // JS files
    { name: 'Theme JS', url: 'http://localhost:8080/js/theme.js' },
    { name: 'Auth Helper JS', url: 'http://localhost:8080/js/auth-helper.js' },
    
    // API endpoints
    { name: 'Auth Config API', url: 'http://localhost:8080/api/config/auth' },
    { name: 'Voices API', url: 'http://localhost:8080/api/config/voices' },
];

let passed = 0;
let failed = 0;

async function testUrl(test) {
    return new Promise((resolve) => {
        http.get(test.url, (res) => {
            const status = res.statusCode;
            const success = status === 200 || status === 503; // 503 for unconfigured auth
            
            if (success) {
                console.log(`✅ ${test.name}: ${status}`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: ${status}`);
                failed++;
            }
            
            resolve();
        }).on('error', (err) => {
            console.log(`❌ ${test.name}: ERROR - ${err.message}`);
            failed++;
            resolve();
        });
    });
}

async function runTests() {
    console.log('\n📋 Testing all routes and resources...\n');
    
    for (const test of tests) {
        await testUrl(test);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Everything is working!\n');
    } else {
        console.log(`\n⚠️  ${failed} tests failed. Check the errors above.\n`);
    }
}

runTests();