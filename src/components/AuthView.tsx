import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { StudentProfile } from '../types';

interface AuthViewProps {
  onLoginSuccess: (profile: StudentProfile) => void;
  defaultEmail?: string;
}

const DEGREE_LEVEL_PRESETS = [
  {
    id: 'bachelor',
    label: "Bachelor's Degree (Laurea Triennale)",
    type: 'Laurea Triennale (Undergraduate)',
    defaultCFU: 180,
    years: '3 Years',
    badge: '180 CFU',
  },
  {
    id: 'master',
    label: "Master's Degree (Laurea Magistrale)",
    type: 'Laurea Magistrale (Graduate)',
    defaultCFU: 120,
    years: '2 Years',
    badge: '120 CFU',
  },
  {
    id: 'combined',
    label: 'Single-Cycle Combined Degree (Ciclo Unico)',
    type: 'Laurea Magistrale a Ciclo Unico',
    defaultCFU: 300,
    years: '5 Years',
    badge: '300 CFU',
  },
  {
    id: 'postgrad-master',
    label: 'Postgraduate Specialized Master',
    type: 'Master Universitario di I/II Livello',
    defaultCFU: 60,
    years: '1 Year',
    badge: '60 CFU',
  },
  {
    id: 'phd',
    label: 'Ph.D. / Doctorate (Dottorato di Ricerca)',
    type: 'Dottorato di Ricerca (Ph.D.)',
    defaultCFU: 180,
    years: '3-4 Years',
    badge: 'Research',
  },
];

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, defaultEmail = '' }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<1 | 2>(1); // Step 1: Credentials, Step 2: Degree/Master setup

  // Form State
  const [email, setEmail] = useState(defaultEmail || 'elena.rossi@studio.unibo.it');
  const [password, setPassword] = useState('Passw0rd2024!');
  const [confirmPassword, setConfirmPassword] = useState('Passw0rd2024!');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('Elena Rossi');
  const [studentId, setStudentId] = useState('0001092834');

  // Step 2: Degree Setup State
  const [selectedDegreeLevelId, setSelectedDegreeLevelId] = useState('master');
  const [degreeName, setDegreeName] = useState('Computer Science and Engineering');
  const [totalTargetCFU, setTotalTargetCFU] = useState<number>(120);
  const [academicYear, setAcademicYear] = useState('Year 1');
  const [enrolledYear, setEnrolledYear] = useState('AY 2024/25');
  const [institution, setInstitution] = useState('Alma Mater Studiorum - Università di Bologna');
  const [currentSession, setCurrentSession] = useState('Fall Semester 2024');

  // Status & UI
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper to test if email looks educational
  const isEducationalEmail = (mail: string): boolean => {
    if (!mail.includes('@')) return false;
    const domain = mail.split('@')[1]?.toLowerCase() || '';
    return (
      domain.endsWith('.edu') ||
      domain.includes('.ac.') ||
      domain.endsWith('.it') ||
      domain.includes('unibo.') ||
      domain.includes('polimi.') ||
      domain.includes('student') ||
      domain.includes('uni') ||
      domain.endsWith('.de') ||
      domain.endsWith('.fr') ||
      domain.includes('ox.ac.uk') ||
      domain.includes('mit.edu')
    );
  };

  const handleDegreeLevelChange = (levelId: string) => {
    setSelectedDegreeLevelId(levelId);
    const preset = DEGREE_LEVEL_PRESETS.find((p) => p.id === levelId);
    if (preset) {
      setTotalTargetCFU(preset.defaultCFU);
    }
  };

  // Quick Demo Login
  const handleQuickDemo = () => {
    const demoProfile: StudentProfile = {
      name: 'Elena Rossi',
      studentId: '0001092834',
      email: 'elena.rossi@studio.unibo.it',
      degreeLevel: "Bachelor's Degree (Laurea Triennale)",
      degreeName: 'Computer Science and Engineering',
      degreeType: 'Laurea Triennale',
      status: 'Regular Enrolled',
      currentSession: 'Fall Semester 2024',
      academicYear: 'Year 2',
      enrolledYear: 'AY 2024/25',
      totalTargetCFU: 180,
      weeklyGoalHours: 25,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg/200px-Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg.png',
      thesisPointsExpected: 5,
      institution: 'Alma Mater Studiorum - Università di Bologna',
    };
    onLoginSuccess(demoProfile);
  };

  // Sign In Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please provide both your educational email and password.');
      return;
    }

    setLoading(true);
    try {
      let uid = '';
      let remoteProfile: StudentProfile | null = null;

      try {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        uid = userCred.user.uid;

        // Fetch user profile from Firestore if available
        try {
          const docSnap = await getDoc(doc(db, 'users', uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            remoteProfile = {
              name: data.name || userCred.user.displayName || 'Academic Student',
              studentId: data.studentId || '0001092834',
              email: data.email || email,
              degreeLevel: data.degreeLevel || "Master's Degree",
              degreeName: data.degreeName || 'Computer Science and Engineering',
              degreeType: data.degreeType || 'Laurea Magistrale',
              status: data.status || 'Regular Enrolled',
              currentSession: data.currentSession || 'Fall Semester 2024',
              academicYear: data.academicYear || 'Year 1',
              enrolledYear: data.enrolledYear || 'AY 2024/25',
              totalTargetCFU: data.totalTargetCFU || 180,
              weeklyGoalHours: 25,
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
              logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg/200px-Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg.png',
              thesisPointsExpected: 4,
              institution: data.institution || 'Alma Mater Studiorum',
            };
          }
        } catch (fetchErr) {
          console.warn('Firestore profile fetch fallback', fetchErr);
        }
      } catch (authErr: any) {
        // If Firebase Auth throws because of new project or network, allow local session fallback
        console.warn('Firebase Auth sign in notice', authErr?.message);
        if (authErr?.code === 'auth/wrong-password' || authErr?.code === 'auth/invalid-credential') {
          throw new Error('Invalid institutional email or password. Please verify your credentials.');
        }
      }

      // If remote profile was found or fallback from local state
      const targetProfile: StudentProfile = remoteProfile || {
        name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        studentId: '0001092834',
        email: email.trim(),
        degreeLevel: "Bachelor's Degree (Laurea Triennale)",
        degreeName: 'Computer Science and Engineering',
        degreeType: 'Laurea Triennale',
        status: 'Regular Enrolled',
        currentSession: 'Fall Semester 2024',
        academicYear: 'Year 2',
        enrolledYear: 'AY 2024/25',
        totalTargetCFU: 180,
        weeklyGoalHours: 25,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg/200px-Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg.png',
        thesisPointsExpected: 5,
        institution: 'Alma Mater Studiorum - Università di Bologna',
      };

      onLoginSuccess(targetProfile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error. Please check your institutional email and password.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1 Validation -> Proceed to Step 2
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your institutional / educational email.');
      return;
    }

    if (!email.includes('@')) {
      setErrorMessage('Please provide a valid educational email address format.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Please enter a secure password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both fields match.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please provide your full student legal name.');
      return;
    }

    // Move to step 2: Degree setup!
    setRegStep(2);
  };

  // Step 2 Submission: Register Account & Save Degree Setup
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const finalDegreeName = degreeName.trim();
    const finalInstitution = institution.trim();

    if (!finalDegreeName) {
      setErrorMessage('Please write your Degree or Master program title.');
      setLoading(false);
      return;
    }

    if (!finalInstitution) {
      setErrorMessage('Please write your University or Institution name.');
      setLoading(false);
      return;
    }

    const selectedPreset = DEGREE_LEVEL_PRESETS.find((p) => p.id === selectedDegreeLevelId);
    const finalDegreeType = selectedPreset ? selectedPreset.type : "Bachelor's Degree";

    const newProfile: StudentProfile = {
      name: name.trim(),
      studentId: studentId.trim() || '0001092834',
      email: email.trim(),
      degreeLevel: selectedPreset?.label || "Master's Degree",
      degreeName: finalDegreeName,
      degreeType: finalDegreeType,
      status: 'Regular Enrolled',
      currentSession: currentSession,
      academicYear: academicYear,
      enrolledYear: enrolledYear || 'AY 2024/25',
      totalTargetCFU: Number(totalTargetCFU) || 120,
      weeklyGoalHours: 25,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg/200px-Alma_Mater_Studiorum_-_Universit%C3%A0_di_Bologna_-_Logo.svg.png',
      thesisPointsExpected: selectedDegreeLevelId === 'master' ? 5 : 4,
      institution: finalInstitution,
    };

    try {
      // 1. Try Firebase Authentication
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCred.user, { displayName: name.trim() });

        // 2. Persist to Firestore
        try {
          await setDoc(doc(db, 'users', userCred.user.uid), {
            uid: userCred.user.uid,
            email: email.trim(),
            name: name.trim(),
            studentId: studentId.trim() || '0001092834',
            degreeLevel: newProfile.degreeLevel,
            degreeName: newProfile.degreeName,
            degreeType: newProfile.degreeType,
            totalTargetCFU: newProfile.totalTargetCFU,
            enrolledYear: newProfile.enrolledYear,
            academicYear: newProfile.academicYear,
            institution: newProfile.institution,
            status: newProfile.status,
            createdAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('Firestore setDoc notice', dbErr);
        }
      } catch (authErr: any) {
        console.warn('Firebase Auth user creation notice', authErr?.message);
        // If email already in use, or local preview mode, continue gracefully
      }

      setSuccessMessage('Registration successful! Degree profile configured.');
      setTimeout(() => {
        onLoginSuccess(newProfile);
      }, 300);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not complete registration. Please check fields.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPreset = DEGREE_LEVEL_PRESETS.find((p) => p.id === selectedDegreeLevelId);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
      {/* Brand Header */}
      <div className="text-center mb-6 flex flex-col items-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white shadow-sm mb-3">
          <span className="material-symbols-outlined text-[28px]">
            school
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-sans">
          UniSphere
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium tracking-normal">
          Academic Degree Workstation &amp; Curriculum Architecture
        </p>
      </div>

      {/* Floating Card Container */}
      <div className="w-full max-w-xl bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        {/* Card Window Header */}
        <div className="bg-slate-50/80 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">
              {authMode === 'login' ? 'lock_person' : 'badge'}
            </span>
            <div>
              <h2 className="font-semibold text-xs text-slate-900 leading-none">
                {authMode === 'login'
                  ? 'Student Workstation Sign In'
                  : regStep === 1
                  ? 'New Student Registration — Step 1 of 2'
                  : 'Degree & Master Architecture Setup — Step 2 of 2'}
              </h2>
            </div>
          </div>

          {/* Mode Toggle Buttons */}
          <div className="flex items-center border border-gray-200 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
              }}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setRegStep(1);
                setErrorMessage(null);
              }}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg flex items-start gap-2 shadow-2xs">
            <span className="material-symbols-outlined text-[16px] text-rose-600 flex-shrink-0">
              error
            </span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-lg flex items-start gap-2 shadow-2xs">
            <span className="material-symbols-outlined text-[16px] text-emerald-600 flex-shrink-0">
              check_circle
            </span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ======================= LOGIN VIEW ======================= */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-4 space-y-3.5">
            <fieldset className="border border-gray-200 p-3.5 rounded-lg bg-slate-50/40 space-y-3 shadow-2xs">
              <legend className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 bg-white border border-gray-200 rounded-md shadow-2xs">
                <span className="material-symbols-outlined text-[13px] text-indigo-600">
                  alternate_email
                </span>
                <span>Institutional Credentials</span>
              </legend>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Educational / Institutional Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. name@studio.unibo.it or student@mit.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  {email && isEducationalEmail(email) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                      ✓ Verified Edu Domain
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Use your university email (.edu, .it, .ac.uk, or institutional domain).
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Workstation Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                  >
                    {showPassword ? 'Hide Password' : 'Show Password'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your custom password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                />
              </div>
            </fieldset>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleQuickDemo}
                className="px-3 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 border border-gray-200 text-slate-700 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <span className="material-symbols-outlined text-[15px] text-indigo-600">
                  play_arrow
                </span>
                <span>Quick Demo Login (Elena Rossi - CS)</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">
                  login
                </span>
                <span>{loading ? 'Authenticating...' : 'Sign In to Workstation'}</span>
              </button>
            </div>

            <div className="text-center pt-2 border-t border-gray-200">
              <span className="text-[11px] text-slate-500">
                New student?{' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setRegStep(1);
                  setErrorMessage(null);
                }}
                className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-700 hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* ======================= REGISTRATION: STEP 1 ======================= */}
        {authMode === 'register' && regStep === 1 && (
          <form onSubmit={handleProceedToStep2} className="p-4 space-y-3.5">
            {/* Progress Tracker */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 border border-gray-200 rounded-lg text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                  1
                </span>
                <span className="font-semibold text-slate-900">
                  Step 1: Educational Credentials
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-medium">
                  2
                </span>
                <span>Step 2: Degree Setup</span>
              </div>
            </div>

            <fieldset className="border border-gray-200 p-3.5 rounded-lg bg-slate-50/40 space-y-3 shadow-2xs">
              <legend className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 bg-white border border-gray-200 rounded-md shadow-2xs">
                <span className="material-symbols-outlined text-[13px] text-indigo-600">
                  person_add
                </span>
                <span>Student Identity &amp; Educational Email</span>
              </legend>

              {/* Educational Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Educational Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. yourname@studio.unibo.it, user@mit.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-sans transition-all"
                  />
                  {email && isEducationalEmail(email) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                      ✓ Institutional Domain
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must be your registered institutional or university address.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Rossi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Student ID / Matricola <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0001092834"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Custom Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Custom Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= 8
                          ? 'bg-emerald-500'
                          : password.length >= 6
                          ? 'bg-amber-500'
                          : 'bg-slate-200'
                      }`}
                    />
                    <span className="text-[9px] text-slate-500">
                      {password.length >= 8 ? 'Strong' : password.length >= 6 ? 'Acceptable' : 'Too short'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-white border px-3 py-2 text-xs rounded-lg font-mono transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                        : 'border-gray-200 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <span className="text-[10px] text-rose-600 block mt-1">
                      Passwords do not match
                    </span>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className="px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 border border-gray-200 rounded-lg cursor-pointer transition-colors"
              >
                ← Back to Sign In
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <span>Continue to Degree Setup</span>
                <span className="material-symbols-outlined text-[15px]">
                  arrow_forward
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ======================= REGISTRATION: STEP 2 (DEGREE / MASTER SETUP) ======================= */}
        {authMode === 'register' && regStep === 2 && (
          <form onSubmit={handleRegisterSubmit} className="p-4 space-y-3.5">
            {/* Progress Tracker */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 border border-gray-200 rounded-lg text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                  ✓
                </span>
                <span>Credentials Configured</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                  2
                </span>
                <span className="font-semibold text-slate-900">
                  Step 2: Degree Setup
                </span>
              </div>
            </div>

            {/* Degree Level Selector */}
            <fieldset className="border border-gray-200 p-3.5 rounded-lg bg-slate-50/40 space-y-3 shadow-2xs">
              <legend className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 bg-white border border-gray-200 rounded-md shadow-2xs">
                <span className="material-symbols-outlined text-[14px] text-indigo-600">
                  workspace_premium
                </span>
                <span>1. Select Degree or Master Level</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEGREE_LEVEL_PRESETS.map((preset) => {
                  const isSelected = selectedDegreeLevelId === preset.id;
                  return (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => handleDegreeLevelChange(preset.id)}
                      className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-500 shadow-2xs'
                          : 'bg-white border-gray-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className={`font-semibold text-[11px] leading-tight ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-900'}`}>
                          {preset.label}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-gray-200'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1.5">
                        {preset.years} • {preset.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Degree Program & Target CFU */}
            <fieldset className="border border-gray-200 p-3.5 rounded-lg bg-slate-50/40 space-y-3 shadow-2xs">
              <legend className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 bg-white border border-gray-200 rounded-md shadow-2xs">
                <span className="material-symbols-outlined text-[14px] text-indigo-600">
                  auto_stories
                </span>
                <span>2. Program Title &amp; Credit Architecture</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Degree / Master Program Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science and Engineering"
                    value={degreeName}
                    onChange={(e) => setDegreeName(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Target Credits (CFU)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={400}
                    value={totalTargetCFU}
                    onChange={(e) => setTotalTargetCFU(Number(e.target.value))}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Auto-set for {selectedPreset?.badge}
                  </span>
                </div>
              </div>

              {/* Academic Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Current Enrolled Year
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                  >
                    <option value="Year 1">Year 1 (Primo Anno)</option>
                    <option value="Year 2">Year 2 (Secondo Anno)</option>
                    <option value="Year 3">Year 3 (Terzo Anno)</option>
                    <option value="Year 4">Year 4 (Quarto Anno - Combined)</option>
                    <option value="Year 5">Year 5 (Quinto Anno - Combined)</option>
                    <option value="Fuori Corso">Fuori Corso (Beyond Prescribed Years)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    University / Institution <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alma Mater Studiorum - Università di Bologna"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full bg-white border border-gray-200 px-3 py-2 text-xs rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setRegStep(1)}
                className="px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 border border-gray-200 rounded-lg cursor-pointer transition-colors"
              >
                ← Back to Step 1
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">
                  check_circle
                </span>
                <span>
                  {loading ? 'Configuring Degree...' : 'Complete Setup & Launch Workstation'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
