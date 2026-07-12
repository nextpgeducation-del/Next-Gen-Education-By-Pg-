/**
 * PG Education - Student Dashboard Logic
 * Handles fetching personal data, fee records, filtered study materials,
 * mock tests, and generating PDF fee receipts for the student.
 */

import { db } from './firebase-config.js';
import { 
    collection, getDocs, doc, getDoc, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // Validate Session
    const sessionStr = localStorage.getItem('studentSession');
    if (!sessionStr) {
        window.location.href = 'login.html';
        return;
    }
    
    const sessionData = JSON.parse(sessionStr);
    const studentMobile = sessionData.mobile;
    const studentClass = sessionData.class;
    
    // Determine Class Group for Notes & Tests (6-8, 9-10, 11-12)
    let classGroup = "";
    const c = parseInt(studentClass);
    if (c >= 6 && c <= 8) classGroup = "6-8";
    else if (c === 9 || c === 10) classGroup = "9-10";
    else if (c === 11 || c === 12) classGroup = "11-12";

    // ============================================================================
    // 1. LOAD STUDENT FEE RECORDS
    // ============================================================================
    async function loadMyFees() {
        const feeBody = document.getElementById('studentFeeBody');
        try {
            const feesRef = collection(db, "fees");
            const q = query(feesRef, where("studentMobile", "==", studentMobile));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                feeBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No fee records found.</td></tr>';
                return;
            }

            // Order logically based on months
            const monthOrder = { "January":1, "February":2, "March":3, "April":4, "May":5, "June":6, "July":7, "August":8, "September":9, "October":10, "November":11, "December":12 };
            let fees = [];
            snapshot.forEach(docSnap => fees.push({ id: docSnap.id, ...docSnap.data() }));
            fees.sort((a, b) => monthOrder[a.month] - monthOrder[b.month]);
            
            feeBody.innerHTML = '';
            fees.forEach(fee => {
                const statusBadge = fee.status === 'Paid' 
                    ? '<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i> Paid</span>' 
                    : '<span class="badge bg-danger"><i class="fa-solid fa-clock me-1"></i> Pending</span>';
                
                const actionBtn = fee.status === 'Paid'
                    ? `<button class="btn btn-sm btn-outline-primary px-3 rounded-pill" onclick="window.downloadStudentReceipt('${fee.id}', '${fee.month}', ${fee.amount}, '${fee.paymentDate}')"><i class="fa-solid fa-download me-1"></i> Download</button>`
                    : `<button class="btn btn-sm btn-outline-secondary px-3 rounded-pill disabled"><i class="fa-solid fa-ban me-1"></i> Unavailable</button>`;

                feeBody.innerHTML += `
                    <tr>
                        <td class="fw-semibold">${fee.month}</td>
                        <td>₹${fee.amount}</td>
                        <td>${statusBadge}</td>
                        <td class="text-muted-theme small">${fee.paymentDate || 'Not Paid'}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Error loading fees: ", error);
            feeBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading fees.</td></tr>';
        }
    }

    // Generate PDF Receipt for Student
    window.downloadStudentReceipt = (feeId, month, amount, paymentDate) => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        pdf.setFillColor(30, 58, 138); // brand-blue
        pdf.rect(0, 0, 210, 40, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "bold");
        pdf.text("PG Education", 105, 20, null, null, "center");
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text("Premium Coaching Institute - Learn Today, Lead Tomorrow", 105, 30, null, null, "center");
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("FEE RECEIPT", 105, 55, null, null, "center");
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Date: ${paymentDate}`, 150, 70);
        pdf.text(`Receipt No: REC-${feeId.substring(0,6)}`, 20, 70);
        
        pdf.text(`Student Name: ${sessionData.name}`, 20, 90);
        pdf.text(`Student ID: ${sessionData.studentID}`, 150, 90);
        pdf.text(`Class: Class ${sessionData.class}`, 20, 100);
        
        // Table Header
        pdf.setFillColor(249, 115, 22); // Orange
        pdf.rect(20, 120, 170, 10, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.text("Description", 25, 127);
        pdf.text("Amount (INR)", 150, 127);
        
        // Table Body
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Tuition Fee - ${month}`, 25, 140);
        pdf.text(`Rs. ${amount}.00`, 150, 140);
        
        pdf.line(20, 150, 190, 150);
        pdf.setFont("helvetica", "bold");
        pdf.text("Total Paid:", 110, 160);
        pdf.text(`Rs. ${amount}.00`, 150, 160);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "italic");
        pdf.text("Thank you for your payment. This is a computer-generated receipt.", 105, 190, null, null, "center");
        
        pdf.save(`Receipt_${sessionData.studentID}_${month}.pdf`);
    };

    // ============================================================================
    // 2. LOAD STUDY MATERIALS (Notes & PYQ)
    // ============================================================================
    async function loadMaterials() {
        const notesBody = document.getElementById('studentNotesBody');
        const pyqBody = document.getElementById('studentPyqBody');
        
        // Fetch Notes
        try {
            const notesRef = collection(db, "notes");
            const qNotes = query(notesRef, where("classGroup", "==", classGroup));
            const snapNotes = await getDocs(qNotes);
            
            notesBody.innerHTML = '';
            if (snapNotes.empty) {
                notesBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No notes available for your class.</td></tr>';
            } else {
                snapNotes.forEach(docSnap => {
                    const data = docSnap.data();
                    const iconColor = data.subject === 'Mathematics' ? 'text-primary' : 'text-orange';
                    notesBody.innerHTML += `
                        <tr>
                            <td><span class="fw-semibold ${iconColor}"><i class="fa-solid fa-book me-2"></i>${data.subject}</span></td>
                            <td>${data.title}</td>
                            <td>
                                <a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                                    <i class="fa-solid fa-arrow-up-right-from-square me-1"></i> View PDF
                                </a>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch (error) {
            console.error("Notes error: ", error);
            notesBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error loading notes.</td></tr>';
        }

        // Fetch PYQ (Only showing class 10/12 based on student class if applicable, or generic)
        try {
            const pyqRef = collection(db, "papers");
            // If student is 9/10, show 10. If 11/12, show 12. Else empty.
            let targetClass = "";
            if (c === 9 || c === 10) targetClass = "10";
            if (c === 11 || c === 12) targetClass = "12";

            if (!targetClass) {
                pyqBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Board papers not applicable for your class.</td></tr>';
            } else {
                const qPyq = query(pyqRef, where("class", "==", targetClass));
                const snapPyq = await getDocs(qPyq);
                
                pyqBody.innerHTML = '';
                if (snapPyq.empty) {
                    pyqBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No previous year papers available.</td></tr>';
                } else {
                    snapPyq.forEach(docSnap => {
                        const data = docSnap.data();
                        pyqBody.innerHTML += `
                            <tr>
                                <td><span class="badge bg-primary-subtle text-primary">${data.board}</span></td>
                                <td class="fw-semibold">${data.year}</td>
                                <td>${data.title}</td>
                                <td>
                                    <a href="${data.url}" target="_blank" class="btn btn-sm btn-outline-orange rounded-pill px-3">
                                        <i class="fa-solid fa-download me-1"></i> Download
                                    </a>
                                </td>
                            </tr>
                        `;
                    });
                }
            }
        } catch (error) {
            console.error("PYQ error: ", error);
        }
    }

    // ============================================================================
    // 3. LOAD MOCK TESTS
    // ============================================================================
    async function loadMockTests() {
        const grid = document.getElementById('studentTestsGrid');
        try {
            const testsRef = collection(db, "mocktests");
            const q = query(testsRef, where("classGroup", "==", classGroup), where("status", "==", "Active"));
            const snapshot = await getDocs(q);
            
            grid.innerHTML = '';
            if (snapshot.empty) {
                grid.innerHTML = '<div class="col-12 text-center py-4"><p class="text-muted-theme">No active mock tests assigned for your class at the moment.</p></div>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const subjectColor = data.subject === 'Mathematics' ? 'primary' : 'orange';
                
                grid.innerHTML += `
                    <div class="col-md-6 col-lg-4">
                        <div class="glass-card p-4 rounded-4 shadow-sm border-top border-3 border-${subjectColor} h-100 d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <span class="badge bg-${subjectColor}-subtle text-${subjectColor} px-2 py-1"><i class="fa-solid fa-bookmark me-1"></i> ${data.subject}</span>
                                <span class="text-muted-theme small"><i class="fa-solid fa-clock text-muted"></i> ${data.duration} Mins</span>
                            </div>
                            <h5 class="fw-bold text-primary-theme mb-2">${data.title}</h5>
                            <p class="text-muted-theme small mb-4">Questions: ${data.questions ? data.questions.length : 0}</p>
                            
                            <div class="mt-auto">
                                <a href="mock-test.html?testId=${docSnap.id}" class="btn btn-${subjectColor}-gradient w-100 rounded-pill py-2 fw-semibold">
                                    Start Test <i class="fa-solid fa-arrow-right ms-1"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            });
        } catch (error) {
            console.error("Mock Test error: ", error);
            grid.innerHTML = '<div class="col-12 text-center text-danger">Error loading mock tests.</div>';
        }
    }

    // ============================================================================
    // 4. LOAD TEST RESULTS
    // ============================================================================
    async function loadTestResults() {
        const resultsBody = document.getElementById('studentResultsBody');
        try {
            const resultsRef = collection(db, "results");
            const q = query(resultsRef, where("studentMobile", "==", studentMobile));
            const snapshot = await getDocs(q);
            
            resultsBody.innerHTML = '';
            if (snapshot.empty) {
                resultsBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No test results found yet. Take a test!</td></tr>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const accuracy = Math.round((data.score / data.totalQuestions) * 100);
                let accColor = 'success';
                if(accuracy < 40) accColor = 'danger';
                else if (accuracy < 75) accColor = 'warning';

                resultsBody.innerHTML += `
                    <tr>
                        <td class="fw-semibold text-primary-theme">${data.testTitle}</td>
                        <td>${data.subject}</td>
                        <td class="fw-bold">${data.score} / ${data.totalQuestions}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <span class="me-2">${accuracy}%</span>
                                <div class="progress flex-grow-1" style="height: 6px;">
                                    <div class="progress-bar bg-${accColor}" role="progressbar" style="width: ${accuracy}%"></div>
                                </div>
                            </div>
                        </td>
                        <td class="text-muted-theme small">${data.dateTaken}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Results error: ", error);
            resultsBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading results.</td></tr>';
        }
    }

    // Initialize all data fetches
    loadMyFees();
    loadMaterials();
    loadMockTests();
    loadTestResults();
});