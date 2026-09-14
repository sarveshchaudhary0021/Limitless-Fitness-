'use strict';

/**
 * Global navigation and auth sync.
 * Ensures "Sign In" becomes "Dashboard" + "Logout" when authed.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth === 'undefined') return;

    const session = Auth.getSession();
    const navActions = document.querySelector('.nav__actions');
    const mobileMenu = document.getElementById('mobile-menu');

    if (session && navActions) {
        // Desktop nav update
        // Preserving theme button if it exists
        const themeBtnHtml = document.getElementById('theme-btn') ? document.getElementById('theme-btn').outerHTML : '<button class="nav__theme-btn" id="theme-btn" aria-label="Toggle theme">🌙</button>';
        
        navActions.innerHTML = `
            ${themeBtnHtml}
            <a href="dashboard.html" class="btn btn-ghost" style="padding:8px 18px;font-size:13px">Dashboard</a>
            <button id="global-logout-btn" class="btn btn-primary" style="padding:9px 20px;font-size:13px">Logout</button>
        `;

        const logoutBtn = document.getElementById('global-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Auth.logout();
            });
        }

        // Mobile menu update
        if (mobileMenu) {
            const authLink = mobileMenu.querySelector('a[href="login.html"]');
            if (authLink) {
                authLink.href = 'dashboard.html';
                authLink.textContent = 'Dashboard →';
            }
            
            // Add logout link to mobile menu
            if (!mobileMenu.querySelector('.logout-mobile-link')) {
                const logoutLink = document.createElement('a');
                logoutLink.href = '#';
                logoutLink.className = 'logout-mobile-link';
                logoutLink.style.color = '#ef4444';
                logoutLink.style.marginTop = '12px';
                logoutLink.textContent = 'Logout';
                logoutLink.onclick = (e) => {
                    e.preventDefault();
                    Auth.logout();
                };
                mobileMenu.appendChild(logoutLink);
            }
        }
    }

    // Re-bind theme toggle if it was replaced or is new
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        // Update icon based on current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        themeBtn.textContent = currentTheme === 'light' ? '🌙' : '☀️';

        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('limitless_theme', next);
            themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
        });
    }
});
