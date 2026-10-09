const fs = require('fs');

let html = fs.readFileSync('pager.html', 'utf8');

// 1. Add iOS Install Prompt UI and Audio tag
const promptUI = `
    <!-- Install Prompt -->
    <div id="iosInstallPrompt" class="container hidden" style="border-color: #3498db; margin-bottom: 20px;">
        <h3 style="color: #3498db; margin-bottom: 10px;">📲 تفعيل الإشعارات بالخلفية</h3>
        <p style="font-size: 15px; color: #ccc; line-height: 1.5; margin-bottom: 15px;">
            لضمان وصول التنبيه حتى لو أغلقت المتصفح، يرجى إضافة الصفحة للشاشة الرئيسية:
        </p>
        <div style="background: #2a2a2a; padding: 10px; border-radius: 10px; text-align: right; font-size: 14px;">
            1. اضغط على زر المشاركة أسفل الشاشة.<br>
            2. اختر <strong>"إضافة للشاشة الرئيسية"</strong> (Add to Home Screen).<br>
            3. افتح التطبيق من الشاشة الرئيسية لتفعيل التنبيهات!
        </div>
    </div>

    <!-- Clean Audio for fallback -->
    <audio id="cleanAlarmSound" preload="auto">
        <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg">
    </audio>
`;

html = html.replace('<!-- Screen 1: Initial load -->', promptUI + '\n    <!-- Screen 1: Initial load -->');

// 2. Replace audio functions
const audioLogicRegex = /function unlockAudio\(\) \{[\s\S]*?\}[\s\S]*?function playLoudAlarm\(\) \{[\s\S]*?\}[\s\S]*?function playTestAlarm\(\) \{[\s\S]*?\}/;
const newAudioLogic = `
        function unlockAudio() {
            const audio = document.getElementById('cleanAlarmSound');
            if (audio) {
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }).catch(e => console.log('Audio unlock failed:', e));
            }
        }

        function playLoudAlarm() {
            const audio = document.getElementById('cleanAlarmSound');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log('Audio play failed:', e));
            }
        }

        function playTestAlarm() {
            playLoudAlarm();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
`;
html = html.replace(audioLogicRegex, newAudioLogic);

// 3. Add standalone detection
const initRegex = /\/\/ Initialize\s+fetchInitialStatus\(\);/;
const standaloneLogic = `
        // Check Standalone (A2HS)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (!isStandalone && isIOS) {
            document.getElementById('iosInstallPrompt').classList.remove('hidden');
        }

        // Initialize
        fetchInitialStatus();
`;
html = html.replace(initRegex, standaloneLogic);

// 4. Redirect on 'completed'
const redirectLogicRegex = /if \(data\.success && \(data\.status === 'ready' \|\| data\.status === 'completed'\)\) \{/;
const newRedirectLogic = `
                    if (data.success && data.status === 'completed') {
                        window.location.href = '/'; // Redirect to main site when completed
                        return;
                    }
                    if (data.success && data.status === 'ready') {
`;
html = html.replace(redirectLogicRegex, newRedirectLogic);

const fetchInitialRedirectRegex = /if \(data\.status === 'ready' \|\| data\.status === 'completed'\) \{/;
const newFetchInitialRedirect = `
                    if (data.status === 'completed') {
                        window.location.href = '/';
                        return;
                    }
                    if (data.status === 'ready') {
`;
html = html.replace(fetchInitialRedirectRegex, newFetchInitialRedirect);

fs.writeFileSync('pager.html', html);
console.log('Fixed pager.html successfully.');
