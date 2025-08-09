// Example: How to add auth to existing pages

// 1. Add these script tags to your HTML pages:
/*
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/auth-helper.js"></script>
*/

// 2. At the start of your page's JavaScript:
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is authenticated
    const user = await requireAuth();
    if (!user) return; // Will redirect to login
    
    // User is authenticated! Show their info
    console.log('Logged in as:', user.email);
    
    // Optional: Add user info to UI
    const userInfoDiv = document.getElementById('userInfo');
    if (userInfoDiv) {
        userInfoDiv.innerHTML = `
            <span>Welcome, ${user.email}</span>
            <button onclick="signOut()">Sign Out</button>
        `;
    }
});

// 3. Update all API calls to use authentication:
// OLD WAY:
// const response = await fetch('/api/assistants', {
//     headers: {
//         'x-user-id': '00000000-0000-0000-0000-000000000000' // Hardcoded!
//     }
// });

// NEW WAY:
async function createAssistant(formData) {
    const response = await authenticatedFetch('/api/assistants/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    });
    
    return response.json();
}

// 4. Example of getting assistants:
async function loadAssistants() {
    try {
        const response = await authenticatedFetch('/api/assistants');
        const result = await response.json();
        
        if (result.success) {
            displayAssistants(result.data);
        }
    } catch (error) {
        console.error('Error loading assistants:', error);
    }
}