// Theme Management System for Voice Matrix AI
class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || 'light';
        this.init();
    }

    init() {
        // Apply theme on initialization
        this.applyTheme(this.theme);
        
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (!this.hasStoredTheme()) {
                    this.theme = e.matches ? 'dark' : 'light';
                    this.applyTheme(this.theme);
                }
            });
        }
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('voice-matrix-theme');
        } catch (e) {
            return null;
        }
    }

    hasStoredTheme() {
        return this.getStoredTheme() !== null;
    }

    setTheme(theme) {
        this.theme = theme;
        this.applyTheme(theme);
        this.storeTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#0F172A' : '#FFFFFF');
        } else {
            // Create meta tag if it doesn't exist
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = theme === 'dark' ? '#0F172A' : '#FFFFFF';
            document.head.appendChild(meta);
        }

        // Update color scheme for better browser integration
        document.documentElement.style.colorScheme = theme;
    }

    storeTheme(theme) {
        try {
            localStorage.setItem('voice-matrix-theme', theme);
        } catch (e) {
            console.warn('Unable to save theme preference');
        }
    }

    getCurrentTheme() {
        return this.theme;
    }

    // Method to create theme toggle button
    createToggleButton() {
        const button = document.createElement('button');
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle dark mode');
        button.setAttribute('title', 'Toggle dark mode');
        button.innerHTML = `
            <svg class="sun-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
            <svg class="moon-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
            </svg>
        `;
        
        button.addEventListener('click', () => {
            this.toggleTheme();
        });

        return button;
    }

    // Method to add toggle button to navigation
    addToggleToNav() {
        const navUser = document.querySelector('.nav-user');
        if (navUser) {
            const toggleButton = this.createToggleButton();
            
            // Insert before the sign out button
            const signOutButton = navUser.querySelector('button');
            if (signOutButton) {
                navUser.insertBefore(toggleButton, signOutButton);
            } else {
                navUser.appendChild(toggleButton);
            }
        }
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    
    // Add toggle button to navigation if it exists
    window.themeManager.addToggleToNav();
});

// Make theme manager available globally
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
}