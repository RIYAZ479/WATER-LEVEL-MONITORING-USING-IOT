// --- App State ---
let port = null;
let reader = null;
let keepReading = true;
let isMockMode = false;
let mockInterval = null;

// --- Config ---
let maxTankDepth = 100; // default cm
const FULL_THRESHOLD_PCT = 85; 
const CRITICAL_THRESHOLD_PCT = 95;

// --- DOM Elements ---
const connectBtn = document.getElementById('connect-btn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');

const waterLevelVal = document.getElementById('water-level-val');
const distanceVal = document.getElementById('distance-val');
const estTimeEl = document.getElementById('est-time');
const statusBadge = document.getElementById('status-val');

const liquidEl = document.getElementById('liquid');
const percentageLarge = document.getElementById('percentage-val-large');
const maxDepthInput = document.getElementById('max-depth');

const fillRateEl = document.getElementById('fill-rate');
const alertsList = document.getElementById('alerts-list');
const emptyAlertsMsg = document.getElementById('empty-alerts');
const clearAlertsBtn = document.getElementById('clear-alerts');
const toastContainer = document.getElementById('toast-container');
const hintBtn = document.getElementById('hint-btn');
const mockHint = document.getElementById('mock-hint');
const themeToggle = document.getElementById('theme-toggle');

const alertSound = document.getElementById('alert-sound');

// --- Data History for Chart & AI ---
const historyLimit = 30; // More points for smoother graph
let timeLabels = [];
let levelData = [];
let lastLevel = null;
let lastTime = null;
let ratesBuffer = []; 

// --- Initialize Chart.js ---
Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#94a3b8';
Chart.defaults.font.family = 'Inter, sans-serif';
const ctx = document.getElementById('waterChart').getContext('2d');
const waterChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: timeLabels,
        datasets: [{
            label: 'Water Level (cm)',
            data: levelData,
            borderColor: '#06b6d4', // cyan-ish
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#0f172a',
            pointBorderColor: '#06b6d4',
            pointBorderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 10,
            fill: true,
            tension: 0.4 // Smooth curve
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: maxTankDepth,
                border: { display: false },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: {
                border: { display: false },
                grid: { display: false },
                ticks: { maxTicksLimit: 6 }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 13, family: 'Inter' },
                bodyFont: { size: 13, family: 'Inter' },
                padding: 10,
                cornerRadius: 8,
                displayColors: false
            }
        },
        animation: { duration: 0 },
        interaction: { mode: 'index', intersect: false }
    }
});

// --- Theme Management ---
function toggleTheme() {
    const htmlObj = document.documentElement;
    const currentTheme = htmlObj.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlObj.setAttribute('data-theme', newTheme);
    
    // Update button icon
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');
    if (newTheme === 'light') {
        icon.className = 'fa-solid fa-sun';
        if(text) text.textContent = 'Light Mode';
        Chart.defaults.color = '#94a3b8';
        waterChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.05)';
    } else {
        icon.className = 'fa-solid fa-moon';
        if(text) text.textContent = 'Dark Mode';
        Chart.defaults.color = '#94a3b8';
        waterChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.05)';
    }
    waterChart.update();
}
themeToggle.addEventListener('click', toggleTheme);

// --- Settings & UI Handlers ---
maxDepthInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if(val >= 10 && val <= 1000) {
        maxTankDepth = val;
        waterChart.options.scales.y.max = maxTankDepth;
        waterChart.update();
        logToHistory('Settings', `Max Depth updated to ${maxTankDepth}cm`, 'info');
        showToast('Settings Updated', `Max depth set to ${maxTankDepth}cm.`, 'info');
        // Recalculate visuals immediately
        const currentDist = parseFloat(distanceVal.textContent);
        const currentLevel = parseFloat(waterLevelVal.textContent);
        if(!isNaN(currentDist) && !isNaN(currentLevel)) {
            processSensorData(currentDist, currentLevel);
        }
    }
});

hintBtn.addEventListener('click', () => mockHint.classList.toggle('hidden'));

clearAlertsBtn.addEventListener('click', () => {
    alertsList.innerHTML = '';
    alertsList.appendChild(emptyAlertsMsg);
    emptyAlertsMsg.style.display = 'flex';
});

// --- Toast & History System ---
function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let iconClass = 'fa-circle-info';
    if(type==='warning') iconClass = 'fa-triangle-exclamation';
    if(type==='critical') iconClass = 'fa-skull-crossbones';
    if(type==='success') iconClass = 'fa-circle-check';

    toast.innerHTML = `
        <div class="toast-icon ${type}">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;

    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // Wait for transition
    }, 5000);
}

function logToHistory(title, message, type = 'info') {
    if(emptyAlertsMsg) emptyAlertsMsg.style.display = 'none';
    
    const item = document.createElement('div');
    item.className = `alert-item ${type}`;
    
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    
    item.innerHTML = `
        <span class="time">${timeStr}</span>
        <span class="message"><strong>${title}:</strong> ${message}</span>
    `;
    
    alertsList.prepend(item);
    
    // Keep max 50 items
    while(alertsList.children.length > 51) { // +1 for the empty message element
        alertsList.removeChild(alertsList.lastChild);
    }
}

// --- Serial Connection logic ---
connectBtn.addEventListener('click', toggleConnection);

async function toggleConnection() {
    if (port) {
        await disconnect();
    } else {
        await connect();
    }
}

async function connect() {
    try {
        statusText.textContent = 'Requesting...';
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected via Serial';
        connectBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Disconnect';
        connectBtn.className = 'btn-primary connected';
        
        isMockMode = false;
        if(mockInterval) clearInterval(mockInterval);
        
        showToast('Connected', 'System actively reading from hardware.', 'success');
        logToHistory('System', 'Connected via Web Serial', 'success');
        
        keepReading = true;
        readLoop();
    } catch (err) {
        statusText.textContent = 'Disconnected';
        showToast('Connection Failed', err.message, 'critical');
        console.error(err);
    }
}

async function disconnect() {
    keepReading = false;
    statusText.textContent = 'Disconnecting...';
    
    if (reader) await reader.cancel();
    if (port) {
        await port.close();
        port = null;
    }
    
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Disconnected';
    connectBtn.innerHTML = '<i class="fa-brands fa-usb"></i> Connect Device';
    connectBtn.className = 'btn-primary';
    showToast('Disconnected', 'Hardware connection ended.', 'warning');
    logToHistory('System', 'Disconnected from hardward', 'warning');
}

async function readLoop() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    let buffer = '';

    try {
        while (keepReading) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                buffer += value;
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep remainder

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) tryParseData(trimmed);
                }
            }
        }
    } catch (err) {
        console.error("Read error:", err);
    } finally {
        reader.releaseLock();
    }
}

function tryParseData(dataStr) {
    let dist = null, lvl = null;
    if (dataStr.includes(',')) {
        const parts = dataStr.split(',');
        dist = parseFloat(parts[0]);
        lvl = parseFloat(parts[1]);
    }
    if (dist !== null && !isNaN(dist) && lvl !== null && !isNaN(lvl)) {
        processSensorData(dist, lvl);
    }
}

// --- Main Logic & State Update ---
let alertState = 'safe'; // safe, warning, critical

function processSensorData(distance, level) {
    let rawPercentage = (level / maxTankDepth) * 100;
    let percentage = Math.max(0, Math.min(rawPercentage, 100)); // clamp 0-100
    
    // 1. Text Metrics
    distanceVal.textContent = distance.toFixed(1);
    waterLevelVal.textContent = level.toFixed(1);
    
    // Animate percentage text loosely (DOM update)
    percentageLarge.textContent = Math.round(percentage);

    // 2. Liquid visual
    liquidEl.style.height = `${percentage}%`;
    
    // 3. Status logic
    evaluateStatus(percentage);
    
    // 4. Analytics
    updateAnalytics(level);
}

function evaluateStatus(percentage) {
    let newState = 'safe';
    liquidEl.classList.remove('warning', 'critical');
    statusBadge.className = 'status-badge safe';
    statusBadge.textContent = 'Normal';
    
    if (percentage >= CRITICAL_THRESHOLD_PCT) {
        newState = 'critical';
        liquidEl.classList.add('critical');
        statusBadge.className = 'status-badge critical';
        statusBadge.textContent = 'CRITICAL FULL';
    } else if (percentage >= FULL_THRESHOLD_PCT) {
        newState = 'warning';
        liquidEl.classList.add('warning');
        statusBadge.className = 'status-badge warning';
        statusBadge.textContent = 'High Level';
    }
    
    // Trigger Notifications on state change upward
    if (newState !== alertState) {
        if (newState === 'critical' && alertState !== 'critical') {
            showToast('CRITICAL ALERT', 'Tank is at critical capacity (>95%)', 'critical');
            logToHistory('Alert', 'Critical tank capacity reached!', 'critical');
            try { alertSound.play(); } catch(e){}
        } else if (newState === 'warning' && alertState === 'safe') {
            showToast('Warning', 'Tank is getting full (>85%)', 'warning');
            logToHistory('Alert', 'High water capacity warning.', 'warning');
            try { alertSound.play(); } catch(e){}
        } else if (newState === 'safe') {
            alertSound.pause();
            alertSound.currentTime = 0;
            if(alertState !== 'safe') {
                showToast('Status Normal', 'Water level has returned to safe levels.', 'success');
                logToHistory('Resolved', 'Water level normalized.', 'success');
            }
        }
        alertState = newState;
    }
}

function updateAnalytics(currentLevel) {
    const now = Date.now();
    
    // Update Chart
    const timeStr = new Date(now).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    timeLabels.push(timeStr);
    levelData.push(currentLevel);
    
    if (timeLabels.length > historyLimit) {
        timeLabels.shift();
        levelData.shift();
    }
    waterChart.update();
    
    // Smart Insights AI
    if (lastLevel !== null && lastTime !== null) {
        const timeDiffMinutes = (now - lastTime) / 60000;
        const levelDiff = currentLevel - lastLevel;
        
        // Compute rates every ~1 second is fine if data comes fast
        if (timeDiffMinutes > 0.015) {
            const rawRate = levelDiff / timeDiffMinutes;
            
            ratesBuffer.push(rawRate);
            if(ratesBuffer.length > 8) ratesBuffer.shift();
            
            const avgRate = ratesBuffer.reduce((a, b) => a + b) / ratesBuffer.length;
            
            fillRateEl.textContent = avgRate.toFixed(2) + ' cm/min';
            
            // Usage trend update visually
            const trendEl = document.querySelector('.insight-row:nth-child(2) .value-text');
            if (avgRate > 1) { // Filling fast
                trendEl.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> Filling Rapidly';
                trendEl.className = 'value-text trend-up';
            } else if (avgRate < -1) { // Draining
                trendEl.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i> High Usage';
                trendEl.className = 'value-text trend-down';
            } else {
                trendEl.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> Stable';
                trendEl.className = 'value-text trend-stable';
            }
            
            // Estimates
            if (avgRate > 0.5) {
                const remainingToFull = maxTankDepth - currentLevel;
                const minutesToFull = remainingToFull / avgRate;
                
                if (minutesToFull < 1) {
                    estTimeEl.textContent = '< 1 min';
                    estTimeEl.style.color = 'var(--danger)';
                } else if (minutesToFull < 60) {
                    estTimeEl.textContent = `~ ${Math.round(minutesToFull)} min`;
                    estTimeEl.style.color = 'var(--warning)';
                } else {
                    const hrs = Math.floor(minutesToFull / 60);
                    const mins = Math.round(minutesToFull % 60);
                    estTimeEl.textContent = `~ ${hrs}h ${mins}m`;
                    estTimeEl.style.color = 'var(--text-primary)';
                }
            } else if (avgRate < -0.5) {
                estTimeEl.textContent = 'Draining...';
                estTimeEl.style.color = 'var(--text-secondary)';
            } else {
                estTimeEl.textContent = 'Stable';
                estTimeEl.style.color = 'var(--text-secondary)';
            }
            
            lastLevel = currentLevel;
            lastTime = now;
        }
    } else {
        lastLevel = currentLevel;
        lastTime = now;
    }
}

// --- Mock Mode (Press M) ---
document.addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !port) {
        isMockMode = !isMockMode;
        
        if (isMockMode) {
            mockHint.classList.add('hidden');
            showToast('Mock Data Active', 'Simulating sensor readings...', 'info');
            logToHistory('System', 'Mock data mode engaged', 'info');
            statusDot.className = 'status-dot connected';
            statusDot.style.background = 'var(--accent-blue)';
            statusDot.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.5)';
            statusText.textContent = 'Mock Simulation Running';
            
            let phase = 0;
            mockInterval = setInterval(() => {
                phase += 0.05; // speed
                // Sin wave logic for interesting data: goes from 0 to 1
                let percentage = (Math.sin(phase) + 1) / 2; 
                let fakeLevel = percentage * maxTankDepth;
                let fakeDistance = maxTankDepth - fakeLevel;
                // Add tiny jitter
                fakeLevel += (Math.random() - 0.5) * 2;
                if(fakeLevel < 0.1) fakeLevel = 0.1;
                fakeDistance = maxTankDepth - fakeLevel;
                
                tryParseData(`${fakeDistance.toFixed(1)},${fakeLevel.toFixed(1)}`);
            }, 1000);
        } else {
            clearInterval(mockInterval);
            showToast('Mock Data Stoped', 'Simulation ended.', 'info');
            statusDot.className = 'status-dot disconnected';
            statusDot.style.background = '';
            statusDot.style.boxShadow = '';
            statusText.textContent = 'Disconnected';
        }
    }
});
