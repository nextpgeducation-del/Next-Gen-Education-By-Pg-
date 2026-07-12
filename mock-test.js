/**
 * PG Education - Mock Test Engine
 * Handles test fetching, timer, question rendering, scoring, and result submission.
 */

import { db } from './firebase-config.js';
import { doc, getDoc, collection, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. Session & Auth Check
    const sessionStr = localStorage.getItem('studentSession');
    if (!sessionStr) {
        window.location.href = 'login.html';
        return;
    }
    const sessionData = JSON.parse(sessionStr);
    
    // Set Topbar Info
    document.getElementById('examStudentName').innerText = sessionData.name.split(' ')[0];
    if(sessionData.photo) {
        const photoEl = document.getElementById('examStudentPhoto');
        photoEl.src = sessionData.photo;
        photoEl.style.display = 'block';
    }

    // 2. Extract Test ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('testId');
    if (!testId) {
        Swal.fire('Error', 'Invalid Test Link.', 'error').then(() => {
            window.location.href = 'dashboard-student.html';
        });
        return;
    }

    // 3. State Variables
    let testData = null;
    let questions = [];
    let currentQuestionIndex = 0;
    let userAnswers = {}; // { questionIndex: 'selectedOptionString' }
    
    let timerInterval;
    let totalSeconds = 0;
    let timeTakenSeconds = 0;

    // 4. Load Test from Firestore
    async function fetchTest() {
        try {
            const testRef = doc(db, "mocktests", testId);
            const testSnap = await getDoc(testRef);
            
            if (testSnap.exists()) {
                testData = testSnap.data();
                questions = testData.questions || [];
                
                if(questions.length === 0) {
                    throw new Error("This test has no questions.");
                }

                // Initialize UI
                document.getElementById('displayTitle').innerText = testData.title;
                document.getElementById('displaySubject').innerText = testData.subject;
                
                totalSeconds = parseInt(testData.duration) * 60;
                
                // Hide loader, show exam panel
                document.getElementById('loadingTest').style.display = 'none';
                document.getElementById('examPanel').style.display = 'block';
                
                renderQuestion();
                startTimer();

            } else {
                throw new Error("Test not found or no longer active.");
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error').then(() => {
                window.location.href = 'dashboard-student.html';
            });
        }
    }

    // 5. Timer Logic
    function startTimer() {
        const timerDisplay = document.getElementById('timeRemaining');
        
        timerInterval = setInterval(() => {
            if (totalSeconds <= 0) {
                clearInterval(timerInterval);
                Swal.fire({
                    title: 'Time is Up!',
                    text: 'Your test will be automatically submitted.',
                    icon: 'warning',
                    confirmButtonColor: '#f97316',
                    allowOutsideClick: false
                }).then(() => {
                    submitTest();
                });
                return;
            }
            
            totalSeconds--;
            timeTakenSeconds++;

            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            
            timerDisplay.innerText = 
                `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            // Make it red and blink when < 2 minutes
            if (totalSeconds <= 120) {
                document.querySelector('.timer-box').style.animation = 'pulseTimer 1s infinite';
                document.querySelector('.timer-box').style.background = 'rgba(239, 68, 68, 0.2)';
            }
        }, 1000);
    }

    // 6. Render Question UI
    function renderQuestion() {
        const q = questions[currentQuestionIndex];
        
        // Progress Bar
        const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;
        document.getElementById('progressBar').style.width = `${progressPercentage}%`;
        document.getElementById('progressText').innerText = `Question ${currentQuestionIndex + 1} of ${questions.length}`;

        // Question Text
        document.getElementById('questionText').innerText = `Q${currentQuestionIndex + 1}. ${q.q}`;
        
        // Options
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        
        q.options.forEach((opt, idx) => {
            const isChecked = userAnswers[currentQuestionIndex] === opt ? 'checked' : '';
            const optionHTML = `
                <div class="form-check p-0">
                    <input class="option-input" type="radio" name="testOption" id="opt${idx}" value="${opt}" ${isChecked}>
                    <label class="option-label" for="opt${idx}">
                        ${String.fromCharCode(65 + idx)}. ${opt}
                    </label>
                </div>
            `;
            optionsContainer.innerHTML += optionHTML;
        });

        // Add event listeners to radio buttons to save state immediately
        document.querySelectorAll('input[name="testOption"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                userAnswers[currentQuestionIndex] = e.target.value;
            });
        });

        // Button States
        document.getElementById('btnPrev').disabled = (currentQuestionIndex === 0);
        
        if (currentQuestionIndex === questions.length - 1) {
            document.getElementById('btnNext').style.display = 'none';
            document.getElementById('btnSubmit').style.display = 'block';
        } else {
            document.getElementById('btnNext').style.display = 'block';
            document.getElementById('btnSubmit').style.display = 'none';
        }
    }

    // Navigation Listeners
    document.getElementById('btnNext').addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        }
    });

    document.getElementById('btnPrev').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    });

    document.getElementById('btnSubmit').addEventListener('click', () => {
        // Warning if questions left unanswered
        const answeredCount = Object.keys(userAnswers).length;
        if (answeredCount < questions.length) {
            Swal.fire({
                title: 'Submit Test?',
                text: `You have answered ${answeredCount} out of ${questions.length} questions. Are you sure?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#ef4444',
                confirmButtonText: 'Yes, Submit!'
            }).then((result) => {
                if (result.isConfirmed) submitTest();
            });
        } else {
            submitTest();
        }
    });

    // 7. Submit & Evaluation Logic
    async function submitTest() {
        clearInterval(timerInterval);
        
        let score = 0;
        questions.forEach((q, index) => {
            if (userAnswers[index] === q.ans) {
                score++;
            }
        });

        const totalQuestions = questions.length;
        const accuracy = Math.round((score / totalQuestions) * 100);
        const minsTaken = Math.floor(timeTakenSeconds / 60);
        const secsTaken = timeTakenSeconds % 60;
        
        // Show Loading State on UI
        document.getElementById('examPanel').style.display = 'none';
        document.getElementById('loadingTest').style.display = 'block';
        document.getElementById('loadingTest').innerHTML = '<div class="spinner-border text-primary mb-3"></div><h4 class="text-primary-theme fw-bold">Evaluating Results...</h4>';

        // 8. Save Result to Firestore
        try {
            const resultId = `RES_${sessionData.studentID}_${Date.now()}`;
            const resultPayload = {
                studentMobile: sessionData.mobile,
                studentName: sessionData.name,
                testId: testId,
                testTitle: testData.title,
                subject: testData.subject,
                score: score,
                totalQuestions: totalQuestions,
                timeTaken: `${minsTaken}m ${secsTaken}s`,
                dateTaken: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                createdAt: serverTimestamp()
            };

            await setDoc(doc(collection(db, "results"), resultId), resultPayload);
            
            // 9. Display Result Panel
            document.getElementById('loadingTest').style.display = 'none';
            document.getElementById('resultPanel').style.display = 'block';
            
            document.getElementById('resultScore').innerText = `${score}/${totalQuestions}`;
            document.getElementById('resultAccuracy').innerText = `${accuracy}%`;
            document.getElementById('resultTime').innerText = `${minsTaken}m ${secsTaken}s`;
            
            // Dynamic Circular Progress style based on accuracy
            const circleColor = accuracy >= 75 ? '#10b981' : (accuracy >= 40 ? '#f59e0b' : '#ef4444');
            const scoreCircle = document.getElementById('scoreCircle');
            scoreCircle.style.background = `conic-gradient(${circleColor} ${accuracy}%, var(--glass-border) 0%)`;

        } catch (error) {
            console.error("Error saving result: ", error);
            Swal.fire('Error', 'Failed to save results. Please take a screenshot of this page.', 'error');
        }
    }

    // Start Process
    fetchTest();
});