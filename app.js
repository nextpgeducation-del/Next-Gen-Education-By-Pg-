/**
 * PG Education - Global Application Logic
 * Handles UI, Theme (Dark/Light), Loading Screen, and Scroll Events
 */

document.addEventListener("DOMContentLoaded", () => {
    
    /* ==========================================================================
       1. Loading Screen Management
       ========================================================================== */
    const loader = document.getElementById('loader');
    if (loader) {
        window.addEventListener('load', () => {
            // Add a slight delay to ensure smooth transition
            setTimeout(() => {
                loader.style.opacity = '0';
                loader.style.visibility = 'hidden';
            }, 500);
        });
    }

    /* ==========================================================================
       2. Dark/Light Theme Toggle
       ========================================================================== */
    const themeToggleBtn = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Check local storage for saved theme preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }

    // Toggle theme on button click
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            
            // Save preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        });
    }

    function updateThemeIcon(isDark) {
        if (!themeToggleBtn) return;
        const icon = themeToggleBtn.querySelector('i');
        if (isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            icon.style.color = '#f97316'; // Orange for sun
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            icon.style.color = ''; // Default for moon
        }
    }

    /* ==========================================================================
       3. Dynamic Navbar Styling on Scroll
       ========================================================================== */
    const navbar = document.querySelector('.glass-navbar');
    
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'var(--glass-bg)';
                navbar.style.boxShadow = 'var(--glass-shadow)';
                navbar.style.padding = '0.5rem 0'; // Shrink slightly
            } else {
                navbar.style.background = 'transparent';
                navbar.style.boxShadow = 'none';
                navbar.style.padding = '1rem 0'; // Restore padding
            }
        }
    });

    /* ==========================================================================
       4. Scroll to Top Button functionality
       ========================================================================== */
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    
    window.addEventListener('scroll', () => {
        if (scrollTopBtn) {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('show');
            } else {
                scrollTopBtn.classList.remove('show');
            }
        }
    });

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    /* ==========================================================================
       5. Initialize Bootstrap Tooltips
       ========================================================================== */
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        // Checking if bootstrap is loaded
        if (typeof bootstrap !== 'undefined') {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        }
    });

    /* ==========================================================================
       6. Live Counter Fetch (Placeholder for Firestore Logic)
       ========================================================================== */
    // The actual fetch is handled in specific files (like counter.js or index page script),
    // but we can set a fallback animation for static counters here.
    const counters = document.querySelectorAll('.counter-box h2');
    const speed = 200; // The lower the slower

    counters.forEach(counter => {
        const updateCount = () => {
            // Check if this counter is strictly numeric (like the Faculty count)
            // Or if it's meant to be updated via Firestore later.
            const targetStr = counter.innerText.replace(/[^0-9]/g, ''); 
            if(!targetStr) return;
            
            const target = +targetStr;
            const count = +counter.getAttribute('data-count') || 0;
            const inc = target / speed;

            if (count < target) {
                counter.setAttribute('data-count', Math.ceil(count + inc));
                counter.innerText = Math.ceil(count + inc) + (counter.innerText.includes('%') ? '%' : (counter.innerText.includes('+') ? '+' : ''));
                setTimeout(updateCount, 1);
            } else {
                // Ensure it ends on exactly the target text format
                if(counter.id !== 'live-students-count') {
                    // let static ones stay, dynamic ones handled in Firebase logic
                }
            }
        };
        // We only trigger this once it scrolls into view (using Intersection Observer)
        const observer = new IntersectionObserver((entries) => {
            if(entries[0].isIntersecting) {
                // updateCount(); // Optional: trigger animation
                observer.disconnect();
            }
        });
        observer.observe(counter);
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker Registered'))
            .catch(err => console.error('❌ Service Worker Registration Failed', err));
    });
}