// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const tabSingle = document.getElementById('tabSingle');
    const tabBulk = document.getElementById('tabBulk');
    const sectionSingle = document.getElementById('sectionSingle');
    const sectionBulk = document.getElementById('sectionBulk');

    const setStatus = (msg, isError = false) => {
        statusDiv.innerText = msg;
        statusDiv.style.color = isError ? '#ff4d4d' : '#4caf50';
    };

    const switchMode = (mode) => {
        if (mode === 'bulk') {
            tabBulk.classList.add('active');
            tabSingle.classList.remove('active');
            sectionBulk.classList.remove('hidden');
            sectionSingle.classList.add('hidden');
        } else {
            tabSingle.classList.add('active');
            tabBulk.classList.remove('active');
            sectionSingle.classList.remove('hidden');
            sectionBulk.classList.add('hidden');
        }
        chrome.storage.local.set({ uiMode: mode });
    };

    tabSingle.addEventListener('click', () => switchMode('single'));
    tabBulk.addEventListener('click', () => switchMode('bulk'));

    // Restore UI state
    chrome.storage.local.get(['uiMode', 'bulkMode'], (result) => {
        if (result.uiMode) switchMode(result.uiMode);
        if (result.bulkMode) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            setStatus("Bulk mode active...");
            if (result.uiMode !== 'bulk') switchMode('bulk');
        }
    });

    // Single Fill Buttons
    const buttons = ['Excellent', 'Good', 'Fair', 'Poor', 'CantJudge'];
    const btnElements = buttons.map(id => document.getElementById(`fill${id}`));

    btnElements.forEach((btn, index) => {
        if (btn) {
            btn.addEventListener('click', () => {
                // Clear other selections and highlight current
                btnElements.forEach(b => b && b.classList.remove('selected'));
                btn.classList.add('selected');

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "fill_survey", rating: buttons[index] }, (response) => {
                        if (response && response.success) {
                            setStatus(`Applied ${buttons[index]}!`);
                        } else {
                            setStatus("Failed to fill survey.", true);
                        }
                    });
                });
            });
        }
    });

    document.getElementById('submitSurvey').addEventListener('click', () => {
        btnElements.forEach(b => b && b.classList.remove('selected'));
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "submit_survey" }, (response) => {
                if (response && response.success) {
                    setStatus("Form submitted!");
                } else {
                    setStatus(response ? response.message : "Failed to submit.", true);
                }
            });
        });
    });

    // Bulk Mode Logic
    const startBtn = document.getElementById('startBulk');
    const stopBtn = document.getElementById('stopBulk');
    const ratingSelect = document.getElementById('bulkRating');

    startBtn.addEventListener('click', () => {
        const rating = ratingSelect.value;
        chrome.storage.local.set({ bulkMode: true, targetRating: rating }, () => {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            setStatus("Bulk mode started!");
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "check_bulk" });
                }
            });
        });
    });

    stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ bulkMode: false }, () => {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            setStatus("Bulk mode stopped.");
        });
    });
});
