// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("ETLAB Automator: Received message:", request.action, request);
  if (request.action === "fill_survey") {
    const ratingLabel = request.rating;
    const results = fillSurvey(ratingLabel);
    console.log("ETLAB Automator: Fill results:", results);
    sendResponse({ success: true, count: results.count });
  } else if (request.action === "submit_survey") {
    console.log("ETLAB Automator: Triggering submission...");
    submitSurvey();
    sendResponse({ success: true });
  } else if (request.action === "check_bulk") {
    handleBulkMode();
    sendResponse({ success: true });
  }
  return true;
});

// Auto-run bulk check on page load
console.log("ETLAB Automator: Content script initialized.");
setTimeout(handleBulkMode, 1000);

// Use MutationObserver for dynamic page changes (SPAs or Mock)
const observer = new MutationObserver((mutations) => {
    // Only trigger if a significant number of nodes are added
    const significantChange = mutations.some(m => m.addedNodes.length > 0);
    if (significantChange) {
        handleBulkMode();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

async function handleBulkMode() {
    const { bulkMode, targetRating } = await chrome.storage.local.get(['bulkMode', 'targetRating']);
    console.log("ETLAB Automator: Bulk Mode status:", bulkMode, "Target:", targetRating);
    if (!bulkMode) return;

    const url = window.location.href.toLowerCase();
    
    // Detect page type using content heuristics (more reliable than URL)
    const radios = document.querySelectorAll('input[type="radio"]');
    const hasTable = !!document.querySelector('table');
    const tableText = hasTable ? document.querySelector('table').innerText.toLowerCase() : "";
    
    // It's a list if there's a table with specific column names
    const isListPage = hasTable && (tableText.includes('teacher') || tableText.includes('subject') || tableText.includes('status'));
    // It's a survey if there are many radio buttons
    const isSurveyPage = radios.length > 5;

    console.log("ETLAB Automator: Page Context - Survey:", isSurveyPage, "List:", isListPage);

    if (isSurveyPage) {
        console.log("ETLAB Automator: Survey Page detected.");
        fillSurvey(targetRating);
        setTimeout(() => {
            console.log("ETLAB Automator: Submitting...");
            submitSurvey();
        }, 2000);
    } else if (isListPage) {
        console.log("ETLAB Automator: List Page detected. Locating next survey...");
        const rows = Array.from(document.querySelectorAll('tr, div.row'));
        let found = false;
        for (const row of rows) {
            const text = row.innerText.toLowerCase();
            if (text.includes('not completed') || text.includes('pending')) {
                const btn = row.querySelector('button, a, .answer-btn');
                if (btn) {
                    console.log("ETLAB Automator: Found pending survey. Clicking...");
                    btn.click();
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            console.log("ETLAB Automator: All surveys completed!");
            chrome.storage.local.set({ bulkMode: false });
        }
    }
}

function findPendingInRows() {
    const rows = Array.from(document.querySelectorAll('tr'));
    return rows.some(r => r.innerText.toLowerCase().includes('not completed'));
}

const POSITIVE_MAPPING = {
  "excellent": [
    "excellent", "less than 10", "no", "satisfactory", "just right", 
    "yes", "pleasant", "sincere", "overall teaching effectiveness"
  ],
  "good": [
    "good", "less than 10", "no", "satisfactory", "just right", 
    "some times", "pleasant", "sincere", "average"
  ],
  "fair": [
    "fair", "10 to 25", "no", "satisfactory", "just right", 
    "some times", "pleasant", "sincere"
  ],
  "poor": [
    "poor", "10 to 25", "no", "inadequate", "just right", 
    "some times", "pleasant", "sincere"
  ],
  "cantjudge": [
    "can't judge", "unable to judge", "blank"
  ]
};

function fillSurvey(targetRating) {
  const radioButtons = document.querySelectorAll('input[type="radio"]');
  let count = 0;
  const questions = {};

  radioButtons.forEach(radio => {
    if (!radio.name) return;
    if (!questions[radio.name]) {
      questions[radio.name] = [];
    }
    questions[radio.name].push(radio);
  });

  const targets = POSITIVE_MAPPING[targetRating.toLowerCase()] || [targetRating.toLowerCase()];

  Object.keys(questions).forEach(name => {
    const group = questions[name];
    let selected = false;
    
    // Strategy 1: Precise Label matching
    for (const radio of group) {
      const labelText = getLabelTextForRadio(radio);
      if (!labelText) continue;

      for (const target of targets) {
        const t = target.toLowerCase();
        // Exact match or contains (but only if it's not too broad)
        if (labelText === t || (t.length > 3 && labelText.includes(t))) {
          console.log(`ETLAB Automator: Matched '${labelText}' with target '${t}' for ${name}`);
          radio.click();
          selected = true;
          count++;
          break;
        }
      }
      if (selected) break;
    }

    // Strategy 2: Fallback only for Excellent
    if (!selected) {
        if (targetRating.toLowerCase() === 'excellent') {
            console.log(`ETLAB Automator: Fallback selecting first option for ${name}`);
            group[0].click();
            count++;
        }
    }
  });

  return { count };
}

function getLabelTextForRadio(radio) {
  // 1. Check for <label for="id">
  if (radio.id) {
    const label = document.querySelector(`label[for="${radio.id}"]`);
    if (label) return label.innerText.trim().toLowerCase();
  }

  // 2. Check if wrapped in <label>
  const parentLabel = radio.closest('label');
  if (parentLabel) return parentLabel.innerText.trim().toLowerCase();

  // 3. Check for text immediately following the radio
  let next = radio.nextSibling;
  let text = "";
  // Check up to 2 siblings to skip empty spaces or small spans
  for (let i = 0; i < 2 && next; i++) {
      if (next.nodeType === Node.TEXT_NODE) {
          text += next.textContent.trim();
      } else if (next.nodeType === Node.ELEMENT_NODE) {
          text += next.innerText.trim();
      }
      if (text.length > 2) break;
      next = next.nextSibling;
  }
  
  if (text) return text.toLowerCase();

  // 4. Check for text in the same container but specifically near the radio
  // As a last resort, we check the parent but this is risky
  return null;
}

function submitSurvey() {
  const submitButton = findSubmitButton();
  if (submitButton) {
    submitButton.click();
  }
}

function findSubmitButton() {
  const buttons = document.querySelectorAll('button, input[type="submit"]');
  for (const btn of buttons) {
    const text = (btn.innerText || btn.value || '').toLowerCase();
    if (text.includes('submit') || text.includes('finish') || text.includes('save')) {
      return btn;
    }
  }
  return null;
}
