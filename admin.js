/**
 * PG Education - Admin Dashboard Logic
 * Handles real-time stats, Student CRUD, Fee Management (with PDF Receipts),
 * Teacher Management (Fixed 2 Teachers), and Content Uploads (Notes, PYQ, Gallery).
 */

import { db } from './firebase-config.js';
import { 
    collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, 
    query, where, onSnapshot, serverTimestamp, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // Core Collections
    const studentsRef = collection(db, "students");
    const deletedStudentsRef = collection(db, "deletedStudents");
    const feesRef = collection(db, "fees");
    const teachersRef = collection(db, "teachers");

    // ============================================================================
    // 1. DASHBOARD OVERVIEW & STATS
    // ============================================================================
    function initDashboardStats() {
        // Real-time listener for Students
        onSnapshot(studentsRef, (snapshot) => {
            document.getElementById('statTotalStudents').innerText = snapshot.size;
            
            // Calculate Today's Registrations
            let todayRegCount = 0;
            const todayStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.admissionDate === todayStr) {
                    todayRegCount++;
                }
            });
            document.getElementById('statTodayReg').innerText = todayRegCount;
            
            // Populate Recent Registrations Table (limit to 5)
            const recentTable = document.getElementById('recentStudentsTable');
            recentTable.innerHTML = '';
            let count = 0;
            // Reverse array to show latest first (assuming default ordered by fetch)
            const docs = snapshot.docs.reverse();
            for (let i = 0; i < docs.length && count < 5; i++) {
                const data = docs[i].data();
                recentTable.innerHTML += `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="${data.photo}" class="rounded-circle me-2" width="30" height="30">
                                <div>
                                    <p class="mb-0 fw-semibold text-primary-theme" style="font-size: 14px;">${data.name}</p>
                                    <p class="mb-0 text-muted-theme" style="font-size: 11px;">${data.studentID}</p>
                                </div>
                            </div>
                        </td>
                        <td>Class ${data.class}</td>
                        <td>${data.admissionDate}</td>
                        <td><span class="badge bg-success-subtle text-success">Active</span></td>
                    </tr>
                `;
                count++;
            }
            if(count === 0) recentTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No recent registrations</td></tr>';
        });

        // Real-time listener for Fees (Calculating Total Collected & Pending)
        onSnapshot(feesRef, (snapshot) => {
            let collected = 0;
            let pending = 0;
            snapshot.forEach(docSnap => {
                const fee = docSnap.data();
                if (fee.status === "Paid") {
                    collected += Number(fee.amount);
                } else if (fee.status === "Pending") {
                    pending++;
                }
            });
            document.getElementById('statFeeCollected').innerText = collected.toLocaleString('en-IN');
            document.getElementById('statPendingFees').innerText = pending;
        });
    }

    // ============================================================================
    // 2. STUDENT MANAGEMENT (List, Search, Terminate, Restore)
    // ============================================================================
    let currentViewIsDeleted = false;
    let allStudentsData = []; // Cache for filtering

    async function loadStudents(showDeleted = false) {
        currentViewIsDeleted = showDeleted;
        const tbody = document.getElementById('studentListBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-orange"></div></td></tr>';
        
        try {
            const targetRef = showDeleted ? deletedStudentsRef : studentsRef;
            const snapshot = await getDocs(targetRef);
            allStudentsData = [];

            // Auto-Cleanup 60-Day old deleted records
            const now = Date.now();
            const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                
                if (showDeleted && data.deletedAt) {
                    // Check if 60 days passed
                    if (now - data.deletedAt > sixtyDaysMs) {
                        deleteDoc(doc(db, "deletedStudents", docSnap.id)); // Permanent Delete
                        return; // Skip rendering
                    }
                }
                allStudentsData.push(data);
            });

            renderStudentTable(allStudentsData);
        } catch (error) {
            console.error("Error loading students: ", error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load data.</td></tr>';
        }
    }

    function renderStudentTable(dataArray) {
        const tbody = document.getElementById('studentListBody');
        tbody.innerHTML = '';
        if (dataArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No records found.</td></tr>';
            return;
        }

        dataArray.forEach(data => {
            const statusBadge = data.status === 'Active' 
                ? '<span class="badge bg-success-subtle text-success">Active</span>'
                : '<span class="badge bg-danger-subtle text-danger">Terminated</span>';

            const actionButtons = currentViewIsDeleted
                ? `<button class="btn btn-sm btn-success px-2 me-1" onclick="window.restoreStudent('${data.mobile}')" title="Restore"><i class="fa-solid fa-rotate-left"></i></button>
                   <button class="btn btn-sm btn-danger px-2" onclick="window.permanentDelete('${data.mobile}')" title="Permanent Delete"><i class="fa-solid fa-trash-can"></i></button>`
                : `<button class="btn btn-sm btn-primary px-2 me-1" onclick="window.viewStudent('${data.mobile}')" title="View"><i class="fa-solid fa-eye"></i></button>
                   <button class="btn btn-sm btn-outline-danger px-2" onclick="window.terminateStudent('${data.mobile}')" title="Terminate"><i class="fa-solid fa-user-xmark"></i></button>`;

            tbody.innerHTML += `
                <tr>
                    <td><img src="${data.photo}" class="rounded-circle" width="40" height="40" style="object-fit:cover;"></td>
                    <td>
                        <strong>${data.studentID}</strong><br>
                        <small class="text-muted-theme">${data.admissionNo}</small>
                    </td>
                    <td>
                        <strong>${data.name}</strong><br>
                        <small class="text-muted-theme">D/O, S/O: ${data.fatherName}</small>
                    </td>
                    <td>
                        Class ${data.class}<br>
                        <small class="text-muted-theme text-truncate d-inline-block" style="max-width: 150px;">${data.school}</small>
                    </td>
                    <td>${data.mobile}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        });
    }

    // Search and Filter Listeners
    document.getElementById('searchStudentInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allStudentsData.filter(s => 
            s.name.toLowerCase().includes(term) || 
            s.mobile.includes(term) || 
            s.studentID.toLowerCase().includes(term)
        );
        renderStudentTable(filtered);
    });

    document.getElementById('filterClassSelect').addEventListener('change', (e) => {
        const cls = e.target.value;
        if (cls === 'All') renderStudentTable(allStudentsData);
        else renderStudentTable(allStudentsData.filter(s => s.class === cls));
    });

    document.getElementById('viewDeletedStudentsBtn').addEventListener('click', (e) => {
        const btn = e.target;
        if (currentViewIsDeleted) {
            btn.innerHTML = '<i class="fa-solid fa-trash-can me-2"></i>Deleted/Terminated';
            btn.classList.replace('btn-secondary', 'btn-outline-danger');
            loadStudents(false);
        } else {
            btn.innerHTML = '<i class="fa-solid fa-users me-2"></i>Active Students';
            btn.classList.replace('btn-outline-danger', 'btn-secondary');
            loadStudents(true);
        }
    });

    // Global Functions for inline onclick handlers
    window.terminateStudent = async (mobile) => {
        const result = await Swal.fire({
            title: 'Terminate Student?',
            text: "They will be moved to Deleted Students for 60 days.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Terminate'
        });

        if (result.isConfirmed) {
            try {
                // Get doc
                const docRef = doc(db, "students", mobile);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    let data = docSnap.data();
                    data.status = "Terminated";
                    data.deletedAt = Date.now();
                    
                    // Move to deletedStudents collection
                    await setDoc(doc(db, "deletedStudents", mobile), data);
                    // Delete from active students
                    await deleteDoc(docRef);
                    
                    Swal.fire('Terminated!', 'Student moved to trash.', 'success');
                    loadStudents(false);
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Failed to terminate student.', 'error');
            }
        }
    };

    window.restoreStudent = async (mobile) => {
        try {
            const docRef = doc(db, "deletedStudents", mobile);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                let data = docSnap.data();
                data.status = "Active";
                delete data.deletedAt;
                
                // Move back to active students
                await setDoc(doc(db, "students", mobile), data);
                // Delete from deletedStudents
                await deleteDoc(docRef);
                
                Swal.fire('Restored!', 'Student has been restored.', 'success');
                loadStudents(true);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to restore student.', 'error');
        }
    };

    window.permanentDelete = async (mobile) => {
        const result = await Swal.fire({
            title: 'Permanent Delete?',
            text: "This action cannot be undone!",
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Delete Permanently'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "deletedStudents", mobile));
                
                // Optional: Delete associated fees
                const feeQuery = query(feesRef, where("studentMobile", "==", mobile));
                const feeSnaps = await getDocs(feeQuery);
                feeSnaps.forEach(async (feeDoc) => {
                    await deleteDoc(doc(db, "fees", feeDoc.id));
                });

                Swal.fire('Deleted!', 'Record wiped completely.', 'success');
                loadStudents(true);
            } catch (error) {
                console.error(error);
            }
        }
    };

    // ============================================================================
    // 3. FEE MANAGEMENT & PDF RECEIPTS
    // ============================================================================
    let currentFeeStudent = null;

    document.getElementById('btnSearchFeeStudent').addEventListener('click', async () => {
        const searchVal = document.getElementById('feeSearchInput').value.trim();
        if (!searchVal) return;

        // Try searching by Mobile first, then StudentID
        let q = query(studentsRef, where("mobile", "==", searchVal));
        let snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            q = query(studentsRef, where("studentID", "==", searchVal.toUpperCase()));
            snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
            const studentData = snapshot.docs[0].data();
            currentFeeStudent = studentData;
            
            // Populate UI
            document.getElementById('feeStudentPhoto').src = studentData.photo;
            document.getElementById('feeStudentName').innerText = studentData.name;
            document.getElementById('feeStudentID').innerText = studentData.studentID;
            document.getElementById('feeStudentClass').innerText = studentData.class;
            document.getElementById('feeStudentMobile').innerText = studentData.mobile;
            
            document.getElementById('feeStudentDetailsPanel').style.display = 'block';
            
            loadFeeMonths(studentData.mobile);
        } else {
            Swal.fire('Not Found', 'No active student found with this ID or Mobile.', 'warning');
            document.getElementById('feeStudentDetailsPanel').style.display = 'none';
        }
    });

    async function loadFeeMonths(mobile) {
        const feeBody = document.getElementById('feeMonthsBody');
        feeBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading fees...</td></tr>';
        
        try {
            const q = query(feesRef, where("studentMobile", "==", mobile));
            const snapshot = await getDocs(q);
            
            // Order logically based on months
            const monthOrder = { "January":1, "February":2, "March":3, "April":4, "May":5, "June":6, "July":7, "August":8, "September":9, "October":10, "November":11, "December":12 };
            let fees = [];
            snapshot.forEach(docSnap => fees.push({ id: docSnap.id, ...docSnap.data() }));
            
            fees.sort((a, b) => monthOrder[a.month] - monthOrder[b.month]);
            
            feeBody.innerHTML = '';
            fees.forEach(fee => {
                const statusBadge = fee.status === 'Paid' 
                    ? '<span class="badge bg-success">Paid</span>' 
                    : '<span class="badge bg-danger">Pending</span>';
                
                const actionBtn = fee.status === 'Paid'
                    ? `<button class="btn btn-sm btn-outline-primary px-3 rounded-pill" onclick="window.generateReceipt('${fee.id}')"><i class="fa-solid fa-download me-1"></i> Receipt</button>`
                    : `<button class="btn btn-sm btn-success px-3 rounded-pill" onclick="window.markFeePaid('${fee.id}')"><i class="fa-solid fa-check me-1"></i> Mark Paid</button>`;

                feeBody.innerHTML += `
                    <tr>
                        <td class="fw-semibold">${fee.month}</td>
                        <td>₹${fee.amount}</td>
                        <td>${statusBadge}</td>
                        <td class="text-muted-theme small">${fee.paymentDate || '-'}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error(error);
        }
    }

    window.markFeePaid = async (feeDocId) => {
        try {
            const today = new Date().toLocaleDateString('en-IN');
            await updateDoc(doc(db, "fees", feeDocId), {
                status: "Paid",
                paymentDate: today
            });
            Swal.fire({
                icon: 'success',
                title: 'Fee Marked as Paid',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            loadFeeMonths(currentFeeStudent.mobile);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Could not update fee.', 'error');
        }
    };

    window.generateReceipt = async (feeDocId) => {
        // Fetch fee document to get correct month and amount
        const docRef = doc(db, "fees", feeDocId);
        const docSnap = await getDoc(docRef);
        if(!docSnap.exists()) return;
        const feeData = docSnap.data();

        // Using jsPDF to generate a premium looking receipt
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
        pdf.text(`Date: ${feeData.paymentDate}`, 150, 70);
        pdf.text(`Receipt No: REC-${feeDocId.substring(0,6)}`, 20, 70);
        
        pdf.text(`Student Name: ${currentFeeStudent.name}`, 20, 90);
        pdf.text(`Student ID: ${currentFeeStudent.studentID}`, 150, 90);
        pdf.text(`Class: Class ${currentFeeStudent.class}`, 20, 100);
        pdf.text(`Mobile: ${currentFeeStudent.mobile}`, 150, 100);
        
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
        pdf.text(`Tuition Fee - ${feeData.month}`, 25, 140);
        pdf.text(`Rs. ${feeData.amount}.00`, 150, 140);
        
        pdf.line(20, 150, 190, 150);
        pdf.setFont("helvetica", "bold");
        pdf.text("Total Paid:", 110, 160);
        pdf.text(`Rs. ${feeData.amount}.00`, 150, 160);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "italic");
        pdf.text("Thank you for your payment. This is a computer-generated receipt.", 105, 190, null, null, "center");
        
        pdf.save(`Receipt_${currentFeeStudent.studentID}_${feeData.month}.pdf`);
    };

    // ============================================================================
    // 4. TEACHERS DIRECTORY (Enforce Strictly 2 Teachers)
    // ============================================================================
    function enforceTeachers() {
        // Strictly hardcoding as per prompt constraint: Only TWO Teachers.
        const teachersTable = document.getElementById('teachersTableBody');
        teachersTable.innerHTML = `
            <tr>
                <td><img src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" class="rounded-circle border border-orange" width="45" height="45" style="object-fit:cover;"></td>
                <td class="fw-bold text-primary-theme">Mr. Priyanshu</td>
                <td><span class="badge bg-primary-subtle text-primary">Mathematics</span></td>
                <td>+91 98XXXXXX01</td>
                <td><span class="badge bg-success">Active</span></td>
                <td><button class="btn btn-sm btn-outline-secondary disabled" title="Restricted"><i class="fa-solid fa-lock"></i> Master Admin</button></td>
            </tr>
            <tr>
                <td><img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" class="rounded-circle border border-primary" width="45" height="45" style="object-fit:cover;"></td>
                <td class="fw-bold text-primary-theme">Mr. Ravi Yadav</td>
                <td><span class="badge bg-orange-subtle text-orange">Science</span></td>
                <td>+91 98XXXXXX02</td>
                <td><span class="badge bg-success">Active</span></td>
                <td><button class="btn btn-sm btn-outline-secondary disabled" title="Restricted"><i class="fa-solid fa-lock"></i> Master Admin</button></td>
            </tr>
        `;
    }

    // ============================================================================
    // 5. CONTENT UPLOADS (Notes, PYQ, Mock Tests, Gallery)
    // ============================================================================
    
    // Upload Notes
    const uploadNotesForm = document.getElementById('uploadNotesForm');
    if(uploadNotesForm) {
        uploadNotesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                classGroup: document.getElementById('noteClass').value,
                subject: document.getElementById('noteSubject').value,
                title: document.getElementById('noteTitle').value.trim(),
                url: document.getElementById('notePdfUrl').value.trim(),
                createdAt: serverTimestamp()
            };
            try {
                await setDoc(doc(collection(db, "notes")), payload);
                Swal.fire('Success', 'Study Note Published.', 'success');
                uploadNotesForm.reset();
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Failed to publish note.', 'error');
            }
        });
    }

    // Upload PYQ
    const uploadPyqForm = document.getElementById('uploadPyqForm');
    if(uploadPyqForm) {
        uploadPyqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                board: document.getElementById('pyqBoard').value,
                class: document.getElementById('pyqClass').value,
                year: document.getElementById('pyqYear').value.trim(),
                title: document.getElementById('pyqTitle').value.trim(),
                url: document.getElementById('pyqPdfUrl').value.trim(),
                createdAt: serverTimestamp()
            };
            try {
                await setDoc(doc(collection(db, "papers")), payload);
                Swal.fire('Success', 'PYQ Paper Published.', 'success');
                uploadPyqForm.reset();
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Failed to publish paper.', 'error');
            }
        });
    }

    // Create Mock Test
    const createMockTestForm = document.getElementById('createMockTestForm');
    if(createMockTestForm) {
        createMockTestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const questionsStr = document.getElementById('testQuestionsJson').value.trim();
                let questionsJson;
                try {
                    questionsJson = JSON.parse(questionsStr);
                } catch(err) {
                    throw new Error("Invalid JSON format for questions.");
                }

                const payload = {
                    title: document.getElementById('testTitle').value.trim(),
                    classGroup: document.getElementById('testClass').value,
                    subject: document.getElementById('testSubject').value,
                    duration: parseInt(document.getElementById('testDuration').value),
                    questions: questionsJson,
                    createdAt: serverTimestamp(),
                    status: "Active"
                };

                await setDoc(doc(collection(db, "mocktests")), payload);
                Swal.fire('Success', 'Mock Test Published.', 'success');
                createMockTestForm.reset();
            } catch (error) {
                console.error(error);
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    // Upload Gallery Image
    const uploadGalleryForm = document.getElementById('uploadGalleryForm');
    if(uploadGalleryForm) {
        uploadGalleryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('galleryTitle').value.trim(),
                url: document.getElementById('galleryImgUrl').value.trim(),
                createdAt: serverTimestamp()
            };
            try {
                await setDoc(doc(collection(db, "gallery")), payload);
                Swal.fire('Success', 'Image added to Gallery.', 'success');
                uploadGalleryForm.reset();
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Failed to add image.', 'error');
            }
        });
    }

    // Initialize Dashboard
    initDashboardStats();
    loadStudents(false);
    enforceTeachers();

});