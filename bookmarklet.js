javascript:(function(){
    const POSITIVE_MAPPING = {
        "excellent": ["excellent", "less than 10", "no", "satisfactory", "just right", "yes", "pleasant", "sincere"],
        "good": ["good", "less than 10", "no", "satisfactory", "just right", "some times", "pleasant", "sincere"]
    };
    function fill(targetRating) {
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        const questions = {};
        radioButtons.forEach(radio => {
            if (!radio.name) return;
            if (!questions[radio.name]) questions[radio.name] = [];
            questions[radio.name].push(radio);
        });
        const targets = POSITIVE_MAPPING[targetRating.toLowerCase()];
        Object.keys(questions).forEach(name => {
            const group = questions[name];
            let selected = false;
            for (const radio of group) {
                const label = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : radio.closest('label');
                if (label) {
                    const labelText = label.innerText.trim().toLowerCase();
                    for (const target of targets) {
                        if (labelText === target || (target.length > 3 && labelText.includes(target))) {
                            radio.click();
                            selected = true;
                            break;
                        }
                    }
                }
                if (selected) break;
            }
            if (!selected) group[0].click();
        });
        alert('Survey filled with ' + targetRating + ' ratings!');
    }
    const choice = confirm('Fill with Excellent? (Cancel for Good)');
    fill(choice ? 'excellent' : 'good');
})();
