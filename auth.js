/**
 * PG Education - Authentication Logic
 * Handles Student Registration and Student Login using Firebase Firestore.
 * Using Mobile Number and Password for login.
 */

import { db } from './firebase-config.js';
import { collection, doc, setDoc, getDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- REGISTRATION LOGIC ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('registerBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;

            try {
                // Gather form data
                const name = document.getElementById('regName').value.trim();
                const fatherName = document.getElementById('regFatherName').value.trim();
                const mobile = document.getElementById('regMobile').value.trim();
                const email = document.getElementById('regEmail').value.trim();
                const schoolName = document.getElementById('regSchool').value.trim();
                const studentClass = document.getElementById('regClass').value;
                const pin = document.getElementById('regPin').value.trim();
                const password = document.getElementById('regPassword').value;
                const confirmPassword = document.getElementById('regConfirmPassword').value;

                // Validation
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match!");
                }
                
                // Check if mobile number already exists in DB
                const studentsRef = collection(db, "students");
                const q = query(studentsRef, where("mobile", "==", mobile));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    throw new Error("This mobile number is already registered. Please login.");
                }

                // Generate Unique ID & Admission Number
                const timestamp = Date.now().toString();
                const studentID = "PG" + timestamp.slice(-6); // e.g., PG123456
                const admissionNo = "ADM" + new Date().getFullYear() + timestamp.slice(-4);
                
                // Get Current Date Format
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                const admissionDate = new Date().toLocaleDateString('en-IN', options);

                // Default Student Object
                const studentData = {
                    studentID: studentID,
                    admissionNo: admissionNo,
                    name: name,
                    fatherName: fatherName,
                    mobile: mobile,
                    email: email || "N/A",
                    school: schoolName,
                    class: studentClass,
                    pin: pin,
                    password: password, // Note: In production, hash this using Cloud Functions. Storing plain for this specific ERP requirement.
                    status: "Active",
                    photo: "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=random",
                    admissionDate: admissionDate,
                    createdAt: serverTimestamp()
                };

                // Save to Firestore under 'students' collection (Doc ID = Mobile Number for unique constraint)
                await setDoc(doc(db, "students", mobile), studentData);

                // --- Generate 12 Months Fee Records ---
                const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const currentMonthIndex = new Date().getMonth();
                
                for (let i = 0; i < 12; i++) {
                    // Loop 12 months starting from admission month
                    const monthIndex = (currentMonthIndex + i) % 12;
                    const feeDocID = `${studentID}_${months[monthIndex]}`;
                    
                    const feeData = {
                        studentID: studentID,
                        studentMobile: mobile,
                        month: months[monthIndex],
                        amount: 1500, // Default fee example
                        status: "Pending",
                        paymentDate: "",
                        receipt: "",
                        remarks: ""
                    };
                    await setDoc(doc(db, "fees", feeDocID), feeData);
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Registration Successful!',
                    html: `Welcome <b>${name}</b>.<br>Your Student ID is: <b>${studentID}</b>`,
                    background: document.body.classList.contains('dark-mode') ? '#1e293b' : '#fff',
                    color: document.body.classList.contains('dark-mode') ? '#fff' : '#000',
                    confirmButtonColor: '#f97316'
                }).then(() => {
                    // Redirect to login
                    window.location.href = 'login.html';
                });

            } catch (error) {
                console.error("Error writing document: ", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Registration Failed',
                    text: error.message || 'Something went wrong. Please try again.',
                    confirmButtonColor: '#f97316'
                });
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LOGIN LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
            btn.disabled = true;

            const mobile = document.getElementById('loginMobile').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                // Fetch student document by mobile number
                const studentRef = doc(db, "students", mobile);
                const studentSnap = await getDoc(studentRef);

                if (studentSnap.exists()) {
                    const data = studentSnap.data();
                    
                    if (data.password === password) {
                        if (data.status === "Terminated") {
                            throw new Error("Your account has been terminated. Contact administration.");
                        }

                        // Store session in localStorage
                        localStorage.setItem('studentSession', JSON.stringify({
                            mobile: data.mobile,
                            name: data.name,
                            studentID: data.studentID,
                            class: data.class,
                            photo: data.photo
                        }));

                        Swal.fire({
                            icon: 'success',
                            title: 'Welcome Back!',
                            text: `Logged in as ${data.name}`,
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => {
                            window.location.href = 'dashboard-student.html';
                        });

                    } else {
                        throw new Error("Incorrect Password!");
                    }
                } else {
                    throw new Error("No account found with this mobile number.");
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: error.message,
                    confirmButtonColor: '#f97316'
                });
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Password visibility toggle helper
    const togglePass = document.getElementById('togglePassword');
    if(togglePass) {
        togglePass.addEventListener('click', () => {
            const passInput = togglePass.previousElementSibling;
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            togglePass.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
        });
    }
});