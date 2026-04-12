/* ==========================================
   FUZZY LOGIC QUIZ BOT - Application Logic
   ========================================== */

// ==========================================
// State
// ==========================================
let quizState = {
    mode: null,           // 'all' or assignment number
    questions: [],        // current quiz questions
    currentIndex: 0,
    correctCount: 0,
    answeredCount: 0,
    answered: false,      // whether current question is answered
    selectedOptions: [],  // currently selected options
    userAnswers: [],      // track all user answers
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    generateAssignmentButtons();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
});

function generateAssignmentButtons() {
    const grid = document.getElementById('assignment-grid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 11; i++) {
        const btn = document.createElement('button');
        btn.className = 'assignment-btn';
        btn.id = `assignment-btn-${i}`;
        btn.onclick = () => startQuiz(i);
        btn.innerHTML = `
            <span class="btn-num">${i}</span>
            <span class="btn-label">Week ${i}</span>
        `;
        grid.appendChild(btn);
    }
}

// ==========================================
// Navigation
// ==========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        target.scrollTop = 0;
        window.scrollTo(0, 0);
    }
}

function goHome() {
    showScreen('landing-screen');
    // Hide assignment picker
    document.getElementById('assignment-picker').classList.add('hidden');
}

function showAssignmentPicker() {
    const picker = document.getElementById('assignment-picker');
    picker.classList.remove('hidden');
    picker.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================
// Quiz Logic
// ==========================================
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function startQuiz(mode) {
    // Reset state
    quizState = {
        mode: mode,
        questions: [],
        currentIndex: 0,
        correctCount: 0,
        answeredCount: 0,
        answered: false,
        selectedOptions: [],
        userAnswers: [],
    };

    // Filter questions
    if (mode === 'all') {
        quizState.questions = shuffleArray(QUESTIONS_DATA);
    } else {
        const assignmentQuestions = QUESTIONS_DATA.filter(q => q.assignment === mode);
        quizState.questions = shuffleArray(assignmentQuestions);
    }

    if (quizState.questions.length === 0) {
        alert('No questions found for this selection.');
        return;
    }

    // Update UI
    const label = mode === 'all' ? 'All Assignments' : `Assignment ${mode}`;
    document.getElementById('quiz-mode-label').textContent = label;
    
    // Show quiz screen
    showScreen('quiz-screen');
    
    // Render first question
    renderQuestion();
}

function renderQuestion() {
    const q = quizState.questions[quizState.currentIndex];
    if (!q) return;

    quizState.answered = false;
    quizState.selectedOptions = [];

    // Update meta info
    document.getElementById('q-assignment-badge').textContent = `Assignment ${q.assignment}`;
    document.getElementById('q-number').textContent = `Q${q.question_number}`;
    
    // Update question text
    document.getElementById('question-text').textContent = q.question;

    // Update progress
    const total = quizState.questions.length;
    const current = quizState.currentIndex + 1;
    document.getElementById('progress-text').textContent = `${current} / ${total}`;
    document.getElementById('progress-bar').style.width = `${(current / total) * 100}%`;

    // Update score
    document.getElementById('score-correct').textContent = quizState.correctCount;
    document.getElementById('score-answered').textContent = quizState.answeredCount;

    // Render options
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    const optionKeys = Object.keys(q.options).sort();
    optionKeys.forEach((key, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.id = `option-${key}`;
        btn.setAttribute('data-option', key);
        btn.onclick = () => selectOption(key);
        btn.innerHTML = `
            <span class="option-letter">${key}</span>
            <span class="option-text">${q.options[key]}</span>
        `;
        // Stagger animation
        btn.style.animation = `slideUp 0.3s ease-out ${index * 0.06}s both`;
        container.appendChild(btn);
    });

    // Multi-select submit button
    if (q.correct_answers.length > 1) {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'next-btn multi-submit-btn';
        submitBtn.id = 'multi-submit-btn';
        submitBtn.innerHTML = `
            Submit Answer
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
        submitBtn.onclick = submitAnswer;
        submitBtn.style.marginTop = '20px';
        container.appendChild(submitBtn);
    }

    // Hide explanation
    document.getElementById('explanation-card').classList.add('hidden');

    // Re-trigger card animation
    const card = document.getElementById('question-card');
    card.style.animation = 'none';
    card.offsetHeight; // Force reflow
    card.style.animation = 'scaleIn 0.35s ease-out';
}

function selectOption(selectedKey) {
    if (quizState.answered) return;

    const q = quizState.questions[quizState.currentIndex];
    const isMultiSelect = q.correct_answers.length > 1;

    if (!isMultiSelect) {
        quizState.selectedOptions = [selectedKey];
        submitAnswer();
    } else {
        const btn = document.getElementById(`option-${selectedKey}`);
        const idx = quizState.selectedOptions.indexOf(selectedKey);
        
        if (idx > -1) {
            quizState.selectedOptions.splice(idx, 1);
            btn.classList.remove('selected');
        } else {
            quizState.selectedOptions.push(selectedKey);
            btn.classList.add('selected');
        }
    }
}

function submitAnswer() {
    if (quizState.answered) return;
    if (quizState.selectedOptions.length === 0) return; // Need at least one

    quizState.answered = true;
    quizState.answeredCount++;

    const q = quizState.questions[quizState.currentIndex];
    const correctAnswers = q.correct_answers;

    // Check if the exact correct combination is selected
    const isCorrect = 
        correctAnswers.length === quizState.selectedOptions.length &&
        correctAnswers.every(val => quizState.selectedOptions.includes(val));

    if (isCorrect) {
        quizState.correctCount++;
    }

    // Store user answer
    quizState.userAnswers.push({
        questionId: q.id,
        selected: [...quizState.selectedOptions],
        correct: isCorrect,
    });

    // Update score display
    document.getElementById('score-correct').textContent = quizState.correctCount;
    document.getElementById('score-answered').textContent = quizState.answeredCount;

    // Hide submit button if present
    const submitBtn = document.getElementById('multi-submit-btn');
    if (submitBtn) submitBtn.style.display = 'none';

    // Mark all options
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => {
        const optKey = btn.getAttribute('data-option');
        
        // Remove 'selected' class to avoid styling conflicts
        btn.classList.remove('selected');
        
        if (correctAnswers.includes(optKey)) {
            btn.classList.add('correct');
            // Add check icon
            const icon = document.createElement('span');
            icon.className = 'option-result-icon';
            icon.textContent = '✓';
            btn.appendChild(icon);
        }
        
        if (quizState.selectedOptions.includes(optKey) && !isCorrect && !correctAnswers.includes(optKey)) {
            btn.classList.add('wrong');
            // Add X icon
            const icon = document.createElement('span');
            icon.className = 'option-result-icon';
            icon.textContent = '✗';
            btn.appendChild(icon);
        }
        
        if (!correctAnswers.includes(optKey) && !quizState.selectedOptions.includes(optKey)) {
            btn.classList.add('disabled');
        }
    });

    // Show explanation
    showExplanation(q, isCorrect, quizState.selectedOptions);
}

function showExplanation(question, isCorrect, selectedKey) {
    const card = document.getElementById('explanation-card');
    const icon = document.getElementById('explanation-icon');
    const title = document.getElementById('explanation-title');
    const textEl = document.getElementById('explanation-text');

    if (isCorrect) {
        icon.textContent = '✅';
        title.textContent = 'Correct!';
        title.className = 'explanation-title correct-title';
    } else {
        icon.textContent = '❌';
        title.textContent = 'Incorrect';
        title.className = 'explanation-title wrong-title';
    }

    // Build explanation HTML
    const correctStr = question.correct_answers.join(', ');
    let html = `<span class="correct-answer-label">Correct Answer: (${correctStr})</span>`;
    
    if (question.explanation && question.explanation.trim() !== '') {
        html += `<br><br>${question.explanation}`;
    }

    textEl.innerHTML = html;

    // Update button text
    const isLast = quizState.currentIndex >= quizState.questions.length - 1;
    const nextBtn = document.getElementById('next-btn');
    if (isLast) {
        nextBtn.innerHTML = `
            View Results
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
    } else {
        nextBtn.innerHTML = `
            Next Question
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
        `;
    }

    // Show card with animation
    card.classList.remove('hidden');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'slideUp 0.4s ease-out';

    // Scroll to explanation
    setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function nextQuestion() {
    if (quizState.currentIndex >= quizState.questions.length - 1) {
        showResults();
        return;
    }

    quizState.currentIndex++;
    renderQuestion();
    
    // Scroll to top of quiz
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// Results
// ==========================================
function showResults() {
    const total = quizState.questions.length;
    const correct = quizState.correctCount;
    const wrong = total - correct;
    const percent = Math.round((correct / total) * 100);

    // Update result screen
    document.getElementById('final-correct').textContent = correct;
    document.getElementById('final-wrong').textContent = wrong;
    document.getElementById('final-total').textContent = total;
    document.getElementById('score-percent').textContent = `${percent}%`;

    // Emoji & message based on score
    const emoji = document.getElementById('results-emoji');
    const title = document.getElementById('results-title');
    const subtitle = document.getElementById('results-subtitle');

    if (percent >= 90) {
        emoji.textContent = '🏆';
        title.textContent = 'Outstanding!';
        subtitle.textContent = 'You\'ve mastered this material!';
    } else if (percent >= 70) {
        emoji.textContent = '🎉';
        title.textContent = 'Great Job!';
        subtitle.textContent = 'You\'re doing really well!';
    } else if (percent >= 50) {
        emoji.textContent = '💪';
        title.textContent = 'Good Effort!';
        subtitle.textContent = 'Keep practicing to improve!';
    } else {
        emoji.textContent = '📚';
        title.textContent = 'Keep Learning!';
        subtitle.textContent = 'Review the material and try again.';
    }

    // Show screen
    showScreen('results-screen');

    // Animate score ring
    const circumference = 2 * Math.PI * 54; // r=54
    const targetOffset = circumference - (percent / 100) * circumference;
    const ring = document.getElementById('score-ring');
    ring.style.strokeDashoffset = circumference;
    ring.style.transition = 'none';
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
            ring.style.strokeDashoffset = targetOffset;
        });
    });
}

function retryQuiz() {
    // Reshuffle same questions
    quizState.questions = shuffleArray(quizState.questions);
    quizState.currentIndex = 0;
    quizState.correctCount = 0;
    quizState.answeredCount = 0;
    quizState.answered = false;
    quizState.selectedOptions = [];
    quizState.userAnswers = [];

    showScreen('quiz-screen');
    renderQuestion();
}

// ==========================================
// Keyboard Navigation
// ==========================================
function handleKeyboard(e) {
    const quizActive = document.getElementById('quiz-screen').classList.contains('active');
    
    if (!quizActive) return;

    // Option selection via keys a-e
    if (!quizState.answered) {
        const key = e.key.toLowerCase();
        if (['a', 'b', 'c', 'd', 'e'].includes(key)) {
            const q = quizState.questions[quizState.currentIndex];
            if (q.options[key] !== undefined) {
                selectOption(key);
            }
        }
    }

    // Submit / Next question with Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
        if (!quizState.answered) {
            const q = quizState.questions[quizState.currentIndex];
            if (q.correct_answers.length > 1 && quizState.selectedOptions.length > 0) {
                e.preventDefault();
                submitAnswer();
            }
        } else {
            e.preventDefault();
            nextQuestion();
        }
    }

    // Number keys 1-5 for options
    if (!quizState.answered) {
        const numMap = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e' };
        if (numMap[e.key]) {
            const q = quizState.questions[quizState.currentIndex];
            if (q.options[numMap[e.key]] !== undefined) {
                selectOption(numMap[e.key]);
            }
        }
    }
}
