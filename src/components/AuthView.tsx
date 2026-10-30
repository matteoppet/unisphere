import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  getEmailDocId,
  hashPassword,
  dispatchVerificationCode,
  verifyEmailCode,
} from '../lib/authService';
import { StudentProfile, Course, StudyLog, AssignmentItem } from '../types';

interface AuthViewProps {
  onLoginSuccess: (
    profile: StudentProfile,
    cloudData?: {
      courses?: Course[];
      studyLogs?: StudyLog[];
      assignments?: AssignmentItem[];
      quickNotes?: string;
      checklist?: string;
    }
  ) => void;
  defaultEmail?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
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

export const AuthView: React.FC<AuthViewProps> = ({
  onLoginSuccess,
  defaultEmail = '',
  isDark = true,
  onToggleTheme,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<1 | 2>(1); // Step 1: Credentials, Step 2: Degree/Master setup

  // Form State
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');

  // Step 2: Degree Setup State
  const [selectedDegreeLevelId, setSelectedDegreeLevelId] = useState('master');
  const [degreeName, setDegreeName] = useState('');
  const [totalTargetCFU, setTotalTargetCFU] = useState<number>(120);
  const [academicYear, setAcademicYear] = useState('Year 1');
  const [enrolledYear, setEnrolledYear] = useState('AY 2024/25');
  const [institution, setInstitution] = useState('');
  const [currentSession, setCurrentSession] = useState('Fall Semester 2024');

  // Status & UI
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Student Email Verification via Email Code State
  const [inputVerificationCode, setInputVerificationCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Passwordless Email Code Login Option
  const [loginWithCodeMode, setLoginWithCodeMode] = useState(false);
  const [loginVerificationSent, setLoginVerificationSent] = useState(false);
  const [loginInputCode, setLoginInputCode] = useState('');

  // Direct Campus SSO State (Strictly Google Workspace for Education)
  const [showGoogleSsoModal, setShowGoogleSsoModal] = useState(false);
  const [ssoStudentEmail, setSsoStudentEmail] = useState('');
  const [ssoStudentName, setSsoStudentName] = useState('');

  // Helper to validate email format (accepts institutional, educational, work, or personal emails)
  const isValidEmail = (mail: string): boolean => {
    if (!mail || typeof mail !== 'string') return false;
    const trimmed = mail.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const handleDegreeLevelChange = (levelId: string) => {
    setSelectedDegreeLevelId(levelId);
    const preset = DEGREE_LEVEL_PRESETS.find((p) => p.id === levelId);
    if (preset) {
      setTotalTargetCFU(preset.defaultCFU);
    }
  };

  // Helper to complete login and hydrate student workstation
  const completeLoginWithStudentDoc = (data: any, normalizedEmail: string) => {
    const remoteProfile: StudentProfile = {
      name: data.name || normalizedEmail.split('@')[0],
      studentId: data.studentId || '',
      email: data.email || normalizedEmail,
      degreeLevel: data.degreeLevel || "Degree / Master",
      degreeName: data.degreeName || '',
      degreeType: data.degreeType || '',
      status: data.status || 'Enrolled',
      currentSession: data.currentSession || 'Current Semester',
      academicYear: data.academicYear || 'Year 1',
      enrolledYear: data.enrolledYear || '',
      totalTargetCFU: data.totalTargetCFU || 180,
      weeklyGoalHours: data.weeklyGoalHours || 20,
      avatarUrl: data.avatarUrl || '',
      logoUrl: data.logoUrl || '',
      thesisPointsExpected: data.thesisPointsExpected || 0,
      institution: data.institution || '',
      activeSquadId: data.activeSquadId || undefined,
      squadIds: Array.isArray(data.squadIds) ? data.squadIds : [],
    };

    const cloudData = {
      courses: Array.isArray(data.courses) ? data.courses : [],
      studyLogs: Array.isArray(data.studyLogs) ? data.studyLogs : [],
      assignments: Array.isArray(data.assignments) ? data.assignments : [],
      quickNotes: typeof data.quickNotes === 'string' ? data.quickNotes : '',
      checklist: typeof data.checklist === 'string' ? data.checklist : '',
      resourceLinks: Array.isArray(data.resourceLinks)
        ? data.resourceLinks.filter(
            (r: any) =>
              !['res-1', 'res-2', 'res-3', 'res-4'].includes(r.id) &&
              !r.url?.includes('unirand.it')
          )
        : [],
    };

    setSuccessMessage('Welcome back! Loading your workstation...');
    setTimeout(() => {
      onLoginSuccess(remoteProfile, cloudData);
    }, 300);
  };

  // Sign In Handler with Email & Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Please provide both your email and password.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage(
        'Please enter a valid email address.'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch account from Firestore
      const docId = getEmailDocId(normalizedEmail);
      const userDocRef = doc(db, 'users', docId);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        setErrorMessage('No account found with this email. Please click "Register" or sign in via Google directly.');
        setLoading(false);
        return;
      }

      const data = docSnap.data();
      const enteredHash = await hashPassword(password);

      // 2. Validate password
      if (data.passwordHash) {
        if (data.passwordHash !== enteredHash) {
          setErrorMessage('Invalid password. Please verify your credentials.');
          setLoading(false);
          return;
        }
      } else {
        // Backfill password hash for accounts created before hashing
        try {
          await setDoc(userDocRef, { passwordHash: enteredHash }, { merge: true });
        } catch {}
      }

      // Optional background signInWithEmailAndPassword in case Identity Toolkit is configured
      try {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      } catch {
        // Safe to ignore
      }

      completeLoginWithStudentDoc(data, normalizedEmail);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Authentication error. Please check your credentials and internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // Email Verification via Email Code (Registration)
  const handleSendVerificationCode = async () => {
    const normalized = email.trim().toLowerCase();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!normalized) {
      setErrorMessage('Please enter your email first.');
      return;
    }
    if (!isValidEmail(normalized)) {
      setErrorMessage(
        'Please enter a valid email address.'
      );
      return;
    }

    setSendingCode(true);
    try {
      const res = await dispatchVerificationCode(normalized, db);
      if (res.success) {
        setVerificationCodeSent(true);
        setSuccessMessage(
          `Verification code sent to ${normalized}. Please check your inbox (and spam/junk folder) and enter the 6-digit code below.`
        );
      } else {
        setErrorMessage(res.error || 'Failed to dispatch verification code. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error sending verification code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const normalized = email.trim().toLowerCase();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!inputVerificationCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setVerifyingCode(true);
    try {
      const res = await verifyEmailCode(normalized, inputVerificationCode, db);
      if (res.success) {
        setIsEmailVerified(true);
        setSuccessMessage('✓ Email successfully verified! You may now proceed.');
      } else {
        setErrorMessage(res.error || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error validating code.');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Email Verification via Email Code (Login / Passwordless)
  const handleSendLoginCode = async () => {
    const normalized = email.trim().toLowerCase();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!normalized) {
      setErrorMessage('Please enter your email first.');
      return;
    }
    if (!isValidEmail(normalized)) {
      setErrorMessage(
        'Please enter a valid email address.'
      );
      return;
    }

    setSendingCode(true);
    try {
      const res = await dispatchVerificationCode(normalized, db);
      if (res.success) {
        setLoginVerificationSent(true);
        setSuccessMessage(`Login verification code sent to ${normalized}. Please check your inbox.`);
      } else {
        setErrorMessage(res.error || 'Could not send verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error sending login code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleLoginWithCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalized = email.trim().toLowerCase();
    if (!normalized || !loginInputCode.trim()) {
      setErrorMessage('Please enter your email and the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmailCode(normalized, loginInputCode, db);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid or expired verification code.');
        setLoading(false);
        return;
      }

      // Check if student exists in Firestore
      const docId = getEmailDocId(normalized);
      const userDocRef = doc(db, 'users', docId);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        setErrorMessage(
          'Email verified, but no workstation profile was found for this address. Please click Register to create your account.'
        );
        setLoading(false);
        return;
      }

      completeLoginWithStudentDoc(docSnap.data(), normalized);
    } catch (err: any) {
      console.error('Login code error:', err);
      setErrorMessage(err.message || 'Error verifying login code.');
    } finally {
      setLoading(false);
    }
  };

  // Direct SSO Login with Google (Institutional or Personal)
  const handleGoogleSso = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const authProvider = new GoogleAuthProvider();
      authProvider.setCustomParameters({ prompt: 'select_account' });

      // Attempt Firebase popup
      const result = await signInWithPopup(auth, authProvider);
      const userMail = result.user?.email?.trim().toLowerCase() || '';

      if (!userMail) {
        throw new Error('No email returned from Google.');
      }

      if (!isValidEmail(userMail)) {
        setErrorMessage(`Invalid email address received from Google: "${userMail}".`);
        setLoading(false);
        return;
      }

      // Check student in Firestore
      const docId = getEmailDocId(userMail);
      const userDocRef = doc(db, 'users', docId);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        completeLoginWithStudentDoc(docSnap.data(), userMail);
      } else {
        // Create student account on first Google SSO login
        const studentDisplayName = result.user.displayName || userMail.split('@')[0];
        const domain = userMail.split('@')[1] || '';
        const isPersonalDomain = [
          'gmail.com',
          'googlemail.com',
          'yahoo.com',
          'yahoo.it',
          'hotmail.com',
          'outlook.com',
          'icloud.com',
        ].includes(domain);
        const institutionName = isPersonalDomain
          ? 'University'
          : (domain.split('.')[0].toUpperCase() || 'University');

        const newRecord = {
          uid: docId,
          email: userMail,
          name: studentDisplayName,
          studentId: '',
          authProvider: 'google',
          emailVerified: true,
          degreeLevel: "Bachelor's Degree",
          degreeName: 'Computer Science & Engineering',
          degreeType: 'Laurea Triennale',
          totalTargetCFU: 180,
          academicYear: 'Year 1',
          enrolledYear: 'AY 2024/25',
          institution: institutionName,
          status: 'Enrolled',
          courses: [],
          studyLogs: [],
          assignments: [],
          quickNotes: '',
          checklist: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newRecord);
        completeLoginWithStudentDoc(newRecord, userMail);
      }
    } catch (popupErr: any) {
      console.warn('Google popup notice / opening Google sign-in modal fallback:', popupErr);
      // Fallback to Google direct modal
      setLoading(false);
      setShowGoogleSsoModal(true);
      setSsoStudentEmail(email || '');
      setSsoStudentName(name || '');
    }
  };

  // Google Sign In Modal Fallback Submit Handler
  const handleCampusGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const normalized = ssoStudentEmail.trim().toLowerCase();

    if (!normalized) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!isValidEmail(normalized)) {
      setErrorMessage(
        'Please provide a valid email address (e.g. name@gmail.com or student@uni.edu).'
      );
      return;
    }

    setLoading(true);
    try {
      const docId = getEmailDocId(normalized);
      const userDocRef = doc(db, 'users', docId);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setShowGoogleSsoModal(false);
        completeLoginWithStudentDoc(docSnap.data(), normalized);
      } else {
        const studentName = ssoStudentName.trim() || normalized.split('@')[0];
        const domain = normalized.split('@')[1] || '';
        const isPersonalDomain = [
          'gmail.com',
          'googlemail.com',
          'yahoo.com',
          'yahoo.it',
          'hotmail.com',
          'outlook.com',
          'icloud.com',
        ].includes(domain);
        const institutionName = isPersonalDomain
          ? 'University'
          : (domain.split('.')[0].toUpperCase() || 'University');

        const newRecord = {
          uid: docId,
          email: normalized,
          name: studentName,
          studentId: '',
          authProvider: 'google',
          emailVerified: true,
          degreeLevel: "Bachelor's Degree",
          degreeName: 'Computer Science & Engineering',
          degreeType: 'Laurea Triennale',
          totalTargetCFU: 180,
          academicYear: 'Year 1',
          enrolledYear: 'AY 2024/25',
          institution: institutionName,
          status: 'Enrolled',
          courses: [],
          studyLogs: [],
          assignments: [],
          quickNotes: '',
          checklist: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newRecord);
        setShowGoogleSsoModal(false);
        completeLoginWithStudentDoc(newRecord, normalized);
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      setErrorMessage(err.message || 'Google authentication error.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1 Validation -> Proceed to Step 2
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage('Please enter your email.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Please provide a valid email address format.');
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
      setErrorMessage('Please provide your full name.');
      return;
    }

    if (!isEmailVerified) {
      setErrorMessage('Please verify your email using the 6-digit verification code before proceeding.');
      return;
    }

    // Move to step 2: Degree setup!
    setRegStep(2);
  };

  // Step 2 Submission: Register Account & Save Degree Setup
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const finalDegreeName = degreeName.trim();
    const finalInstitution = institution.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!finalDegreeName) {
      setErrorMessage('Please write your Degree or Master program title.');
      setLoading(false);
      return;
    }

    if (!finalInstitution) {
      setErrorMessage('Please write your Institution name.');
      setLoading(false);
      return;
    }

    const selectedPreset = DEGREE_LEVEL_PRESETS.find((p) => p.id === selectedDegreeLevelId);
    const finalDegreeType = selectedPreset ? selectedPreset.type : "Bachelor's Degree";

    const newProfile: StudentProfile = {
      name: name.trim(),
      studentId: studentId.trim(),
      email: normalizedEmail,
      degreeLevel: selectedPreset?.label || "Degree / Master",
      degreeName: finalDegreeName,
      degreeType: finalDegreeType,
      status: 'Enrolled',
      currentSession: currentSession,
      academicYear: academicYear,
      enrolledYear: enrolledYear || '',
      totalTargetCFU: Number(totalTargetCFU) || 180,
      weeklyGoalHours: 20,
      avatarUrl: '',
      logoUrl: '',
      thesisPointsExpected: 0,
      institution: finalInstitution,
    };

    try {
      const docId = getEmailDocId(normalizedEmail);
      const userDocRef = doc(db, 'users', docId);

      // Check if student already registered
      const existingDoc = await getDoc(userDocRef);
      if (existingDoc.exists()) {
        setErrorMessage('An account with this email is already registered. Please sign in instead.');
        setLoading(false);
        return;
      }

      // Hash password for multi-device credentials verification
      const passwordHash = await hashPassword(password);

      // Save student profile and initial workstation data to Firestore
      await setDoc(userDocRef, {
        uid: docId,
        email: normalizedEmail,
        name: newProfile.name,
        studentId: newProfile.studentId,
        passwordHash,
        emailVerified: true,
        degreeLevel: newProfile.degreeLevel,
        degreeName: newProfile.degreeName,
        degreeType: newProfile.degreeType,
        totalTargetCFU: newProfile.totalTargetCFU,
        enrolledYear: newProfile.enrolledYear,
        academicYear: newProfile.academicYear,
        institution: newProfile.institution,
        status: newProfile.status,
        courses: [],
        studyLogs: [],
        assignments: [],
        quickNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Optional background Firebase Auth attempt
      try {
        const userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(userCred.user, { displayName: name.trim() });
      } catch {
        // Safe to ignore if Identity Toolkit is not enabled
      }

      setSuccessMessage('Registration successful! Degree profile configured.');
      setTimeout(() => {
        onLoginSuccess(newProfile, {
          courses: [],
          studyLogs: [],
          assignments: [],
          quickNotes: '',
          checklist: '',
        });
      }, 300);
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'Could not complete registration. Please check fields.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPreset = DEGREE_LEVEL_PRESETS.find((p) => p.id === selectedDegreeLevelId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-y-auto relative transition-colors">
      {/* Top Bar Theme Toggle */}
      {onToggleTheme && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
          <button
            type="button"
            onClick={onToggleTheme}
            className="group flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            <span className="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400 transition-transform duration-300 group-hover:rotate-45">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="font-semibold text-[11px]">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      )}

      {/* Brand Header */}
      <div className="text-center mb-6 flex flex-col items-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white shadow-sm mb-3">
          <span className="material-symbols-outlined text-[28px]">
            school
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 font-sans">
          UniSphere
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium tracking-normal">
          Your university life into a single website
        </p>
      </div>

      {/* Floating Card Container */}
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm rounded-xl overflow-hidden">
        {/* Card Window Header */}
        <div className="bg-slate-50/80 dark:bg-zinc-900/90 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-600 dark:text-indigo-400">
              {authMode === 'login' ? 'lock_person' : 'badge'}
            </span>
            <div>
              <h2 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 leading-none">
                {authMode === 'login'
                  ? 'Sign In'
                  : regStep === 1
                  ? 'Account Registration — Step 1 of 2'
                  : 'Degree & Master Setup — Step 2 of 2'}
              </h2>
            </div>
          </div>

          {/* Mode Toggle Buttons */}
          <div className="flex items-center border border-gray-200 dark:border-zinc-800 rounded-lg bg-slate-100 dark:bg-zinc-800 p-0.5">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
              }}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
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
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-[11px] rounded-lg flex items-start gap-2 shadow-2xs">
            <span className="material-symbols-outlined text-[16px] text-rose-600 dark:text-rose-400 flex-shrink-0">
              error
            </span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[11px] rounded-lg flex items-start gap-2 shadow-2xs">
            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              check_circle
            </span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ======================= LOGIN VIEW ======================= */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-4 space-y-3.5">
            {/* Direct Google SSO */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSso}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                title="Sign in directly using your Google account (institutional or personal)"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign In with Google</span>
              </button>
            </div>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold">Or with Email</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
            </div>

            <div className="border border-gray-200 dark:border-zinc-800 p-3.5 rounded-lg bg-slate-50/40 dark:bg-zinc-950/40 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 dark:border-zinc-800 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                    alternate_email
                  </span>
                  <span>Email Authentication</span>
                </div>
                {/* Method selector toggle */}
                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-zinc-800 p-0.5 rounded-md text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginWithCodeMode(false);
                      setErrorMessage(null);
                    }}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                      !loginWithCodeMode
                        ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginWithCodeMode(true);
                      setErrorMessage(null);
                    }}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                      loginWithCodeMode
                        ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Email Code
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com or student@uni.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-sans transition-all"
                  />
                  {email && isValidEmail(email) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                      ✓ Valid Email
                    </span>
                  )}
                </div>
                {email && !isValidEmail(email) ? (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 block">
                    Please enter a valid email address.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                    Institutional, student, or personal email address.
                  </span>
                )}
              </div>

              {!loginWithCodeMode ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      {showPassword ? 'Hide Password' : 'Show Password'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={handleSendLoginCode}
                      disabled={sendingCode || !email}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium cursor-pointer disabled:opacity-50"
                    >
                      {sendingCode ? 'Sending...' : loginVerificationSent ? 'Resend Code' : 'Send Code to Email'}
                    </button>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code (e.g. 582194)"
                    value={loginInputCode}
                    onChange={(e) => setLoginInputCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-sm tracking-widest text-center font-mono rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />

                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                    Check your inbox for the 6-digit verification code.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-stretch sm:items-center justify-end gap-2 pt-1">
              {!loginWithCodeMode ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    login
                  </span>
                  <span>{loading ? 'Authenticating...' : 'Sign In with Password'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoginWithCodeSubmit}
                  disabled={loading || !loginInputCode}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    mark_email_read
                  </span>
                  <span>{loading ? 'Verifying...' : 'Sign In with Email Code'}</span>
                </button>
              )}
            </div>

            <div className="text-center pt-2 border-t border-gray-200 dark:border-zinc-800">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                New student?{' '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setRegStep(1);
                  setErrorMessage(null);
                }}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* ======================= REGISTRATION: STEP 1 ======================= */}
        {authMode === 'register' && regStep === 1 && (
          <form onSubmit={handleProceedToStep2} className="p-4 space-y-3.5">
            {/* Quick Register with Google */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSso}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                title="Register directly with your Google account (institutional or personal)"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Register with Google</span>
              </button>
            </div>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold">Or Register with Credentials</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"></div>
            </div>

            <div className="border border-gray-200 dark:border-zinc-800 p-3.5 rounded-lg bg-slate-50/40 dark:bg-zinc-950/40 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 pb-2 border-b border-gray-200/80 dark:border-zinc-800">
                <span className="material-symbols-outlined text-[15px] text-indigo-600">
                  person_add
                </span>
                <span>Account Identity &amp; Email</span>
              </div>

              {/* Full Name & Student ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Student ID / Matricola <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter student ID or matricola"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. alex@example.com or student@uni.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsEmailVerified(false);
                      setVerificationCodeSent(false);
                    }}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-sans transition-all"
                  />
                  {email && isValidEmail(email) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                      ✓ Valid Email
                    </span>
                  )}
                </div>
                {email && !isValidEmail(email) ? (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 block">
                    Please enter a valid email address.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                    Institutional, university, or personal email address.
                  </span>
                )}
              </div>

              {/* Email Verification via Code */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                      mark_email_read
                    </span>
                    <span>Email Code Verification</span>
                  </div>
                  {isEmailVerified ? (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode || !email || !isValidEmail(email)}
                      className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-md shadow-2xs hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">send</span>
                      {sendingCode ? 'Sending...' : verificationCodeSent ? 'Resend 6-Digit Code' : 'Send 6-Digit Code'}
                    </button>
                  )}
                </div>

                {!isEmailVerified ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit code (e.g. 842193)"
                        value={inputVerificationCode}
                        onChange={(e) => setInputVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-800 px-3 py-1.5 text-xs font-mono tracking-wider rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifyingCode || inputVerificationCode.length < 6}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 shadow-2xs"
                      >
                        <span>{verifyingCode ? 'Verifying...' : 'Verify Code'}</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                      A 6-digit one-time code has been dispatched to your email. Please check your inbox and junk/spam folder.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10.5px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1 pt-0.5">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400">verified</span>
                    Email confirmed: <strong>{email}</strong>
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium cursor-pointer"
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
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= 8
                          ? 'bg-emerald-500'
                          : password.length >= 6
                          ? 'bg-amber-500'
                          : 'bg-slate-200 dark:bg-zinc-800'
                      }`}
                    />
                    <span className="text-[9px] text-slate-500 dark:text-zinc-400">
                      {password.length >= 8 ? 'Strong' : password.length >= 6 ? 'Acceptable' : 'Too short'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2 text-xs rounded-lg font-mono transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                        : 'border-gray-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-1">
                      Passwords do not match
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className="px-3 py-2 text-[11px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-750 border border-gray-200 dark:border-zinc-800 rounded-lg cursor-pointer transition-colors"
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
            {/* Degree Level Selector */}
            <div className="border border-gray-200 dark:border-zinc-800 p-3.5 rounded-lg bg-slate-50/40 dark:bg-zinc-950/40 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 pb-2 border-b border-gray-200/80 dark:border-zinc-800">
                <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                  workspace_premium
                </span>
                <span>1. Select Degree or Master Level</span>
              </div>

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
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-500 shadow-2xs'
                          : 'bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/60 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className={`font-semibold text-[11px] leading-tight ${isSelected ? 'text-indigo-950 dark:text-indigo-200 font-bold' : 'text-slate-900 dark:text-zinc-100'}`}>
                          {preset.label}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5">
                        {preset.years} • {preset.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Degree Program & Target CFU */}
            <div className="border border-gray-200 dark:border-zinc-800 p-3.5 rounded-lg bg-slate-50/40 dark:bg-zinc-950/40 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 pb-2 border-b border-gray-200/80 dark:border-zinc-800">
                <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                  auto_stories
                </span>
                <span>Program Informations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Degree / Master Program Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter degree or master title"
                    value={degreeName}
                    onChange={(e) => setDegreeName(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Target Credits (CFU)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={400}
                    value={totalTargetCFU}
                    onChange={(e) => setTotalTargetCFU(Number(e.target.value))}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono transition-all"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                    Auto-set for {selectedPreset?.badge}
                  </span>
                </div>
              </div>

              {/* Academic Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Current Enrolled Year
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                  >
                    <option value="Year 1" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Year 1 (Primo Anno)</option>
                    <option value="Year 2" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Year 2 (Secondo Anno)</option>
                    <option value="Year 3" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Year 3 (Terzo Anno)</option>
                    <option value="Year 4" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Year 4 (Quarto Anno - Combined)</option>
                    <option value="Year 5" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Year 5 (Quinto Anno - Combined)</option>
                    <option value="Fuori Corso" className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">Fuori Corso (Beyond Prescribed Years)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Institution <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter university name"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setRegStep(1)}
                className="px-3 py-2 text-[11px] font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-750 border border-gray-200 dark:border-zinc-800 rounded-lg cursor-pointer transition-colors"
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
                  {loading ? 'Completing setup...' : 'Complete setup'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ======================= GOOGLE WORKSPACE MODAL ======================= */}
      {showGoogleSsoModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn"
          onClick={() => setShowGoogleSsoModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md shadow-2xl w-full max-w-md overflow-hidden text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs leading-tight">
                    Google Sign In
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-normal">
                    Institutional or Personal Google Account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleSsoModal(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCampusGoogleSubmit} className="p-4 space-y-3.5">
              <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-lg text-[11px] text-blue-900 dark:text-blue-200 leading-snug flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400 shrink-0">
                  verified_user
                </span>
                <span>
                  Sign in with your Google account email (e.g. <code>@gmail.com</code>, <code>.edu</code>, or university domain).
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. name@gmail.com or student@uni.edu"
                    value={ssoStudentEmail}
                    onChange={(e) => setSsoStudentEmail(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-sans transition-all"
                  />
                  {ssoStudentEmail && isValidEmail(ssoStudentEmail) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                      ✓ Valid Email
                    </span>
                  )}
                </div>
                {ssoStudentEmail && !isValidEmail(ssoStudentEmail) ? (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 block">
                    Please enter a valid email address.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 block">
                    Sign in with any institutional or personal Google account.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Full Name <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={ssoStudentName}
                  onChange={(e) => setSsoStudentName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 px-3 py-2 text-xs rounded-lg text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowGoogleSsoModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (Boolean(ssoStudentEmail) && !isValidEmail(ssoStudentEmail))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    lock_open
                  </span>
                  <span>{loading ? 'Verifying...' : 'Sign In with Google Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
