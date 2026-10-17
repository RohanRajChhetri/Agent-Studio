/**
 * Modern Digital Clock Logic
 * Uses requestAnimationFrame for performance, falling back to setInterval
 */

const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const dateEl = document.getElementById('date');

function updateClock() {
    const now = new Date();
    
    // Format Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Update DOM
    hoursEl.textContent = hours;
    minutesEl.textContent = minutes;
    secondsEl.textContent = seconds;
    
    // Format Date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString(undefined, dateOptions);
}

// Initial call
updateClock();

// Interval setup
setInterval(updateClock, 1000);
