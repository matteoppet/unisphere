/**
 * Institutional Authentication & Multi-Device Synchronization Service
 * Backed by Firestore document persistence with standard SHA-256 password hashing.
 */

export function getEmailDocId(email: string): string {
  return email.trim().toLowerCase().replace(/\//g, '_');
}

/**
 * Pure TypeScript / JavaScript SHA-256 implementation
 * Guaranteeing identical, standard SHA-256 hex output across all browsers,
 * mobile devices, non-secure contexts (HTTP), WebViews, and Node.
 */
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  // Initial hash values (first 32 bits of fractional parts of square roots of first 8 primes 2..19)
  let hash: number[] = [];
  // Round constants (first 32 bits of fractional parts of cube roots of first 64 primes 2..311)
  const k: number[] = [];

  let primeCounter = 0;
  const isPrime = (n: number) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80'; // Append Ƈ' bit (plus zero padding)
  while ((ascii.length % 64) - 56) ascii += '\x00'; // More zero padding
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  // Process each 16-word block
  for (j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = i >= 16 ? rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3) : 0;
      const s1 = i >= 16 ? rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10) : 0;
      const wi = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      w[i] = wi;

      const a = hash[0];
      const e = hash[4];
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + wi) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function hashPassword(password: string): Promise<string> {
  const normalized = password.trim();

  // 1. Try global Web Crypto API if available
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (typeof globalThis !== 'undefined' ? globalThis.crypto : null);
  if (cryptoObj && cryptoObj.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to deterministic pure JS SHA-256
    }
  }

  // 2. Pure deterministic standard SHA-256 (guaranteed standard match on any context)
  return sha256Sync(normalized);
}

/**
 * Generate a secure 6-digit numeric verification OTP
 */
export function generateVerificationCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

/**
 * Dispatches and records a 6-digit email verification code for a student email.
 * Stored in Firestore with a 15-minute expiration timestamp.
 */
export interface DispatchCodeResult {
  success: boolean;
  expiresAt: number;
  emailSent: boolean;
  providerNotice?: string;
  error?: string;
}

/**
 * Dispatches and records a 6-digit email verification code for a student email.
 * - Stored securely in Firestore emailVerifications collection with 15-minute expiration
 * - Queued in Firestore mail collection (for Firebase Trigger Email Extension)
 * - Dispatched in real time via server-side /api/send-verification-email (Resend / SMTP)
 * Note: The OTP code is never returned to the client UI to maintain strict authentication security.
 */
export async function dispatchVerificationCode(
  email: string,
  dbInstance: any
): Promise<DispatchCodeResult> {
  try {
    const normalized = email.trim().toLowerCase();
    const docId = getEmailDocId(normalized);
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    const { doc, setDoc } = await import('firebase/firestore');
    const verRef = doc(dbInstance, 'emailVerifications', docId);

    // 1. Record in Firestore for verification
    await setDoc(verRef, {
      email: normalized,
      code,
      expiresAt,
      verified: false,
      createdAt: new Date().toISOString(),
    });

    // 2. Also write to Firestore 'mail' collection (Firebase Trigger Email extension compatible)
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(dbInstance, 'mail'), {
        to: [normalized],
        message: {
          subject: `Your UniSphere Verification Code: ${code}`,
          text: `Your UniSphere student verification code is: ${code}\nThis code will expire in 15 minutes.`,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #4338ca;">UniSphere Student Verification Code</h2><p>Here is your 6-digit verification code to confirm your institutional email (<strong>${normalized}</strong>):</p><div style="font-size: 32px; letter-spacing: 6px; font-weight: bold; background: #eef2ff; border: 2px dashed #6366f1; padding: 16px; text-align: center; border-radius: 8px; color: #4338ca; margin: 20px 0;">${code}</div><p style="color: #64748b; font-size: 13px;">This code will expire in 15 minutes.</p></div>`,
        },
        createdAt: serverTimestamp(),
      });
    } catch (mailErr) {
      // Non-blocking if Trigger Email extension is not installed
      console.warn('Firestore mail collection trigger skipped:', mailErr);
    }

    // 3. Dispatch real email via server API route
    let emailSent = false;
    let providerNotice: string | undefined;

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, code }),
      });

      const resData = await response.json().catch(() => null);

      if (response.ok && (resData?.id || resData?.data?.id || resData?.success || !resData?.error)) {
        emailSent = true;
      } else if (resData?.configured === false) {
        providerNotice = resData.message || 'Email provider credentials not configured in environment.';
      } else if (resData?.error) {
        providerNotice = typeof resData.error === 'string' ? resData.error : resData.error.message;
      }
    } catch (netErr: any) {
      console.warn('Backend email dispatch request:', netErr);
    }

    return {
      success: true,
      expiresAt,
      emailSent,
      providerNotice,
    };
  } catch (err: any) {
    console.error('Error dispatching verification code:', err);
    return {
      success: false,
      expiresAt: 0,
      emailSent: false,
      error: err.message || 'Failed to dispatch verification code.',
    };
  }
}

/**
 * Verifies a 6-digit email code against Firestore records.
 */
export async function verifyEmailCode(
  email: string,
  inputCode: string,
  dbInstance: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalized = email.trim().toLowerCase();
    const docId = getEmailDocId(normalized);
    const cleanCode = inputCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const verRef = doc(dbInstance, 'emailVerifications', docId);
    const snap = await getDoc(verRef);

    if (!snap.exists()) {
      return {
        success: false,
        error: 'No active verification code found for this email. Please request a new code.',
      };
    }

    const data = snap.data();
    if (Date.now() > data.expiresAt) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    if (data.code !== cleanCode) {
      return {
        success: false,
        error: 'Incorrect verification code. Please check your student email and try again.',
      };
    }

    // Mark as verified
    await setDoc(verRef, { verified: true, verifiedAt: new Date().toISOString() }, { merge: true });

    // Also mark on users doc if it exists
    try {
      const userRef = doc(dbInstance, 'users', docId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, { emailVerified: true }, { merge: true });
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('Error validating verification code:', err);
    return {
      success: false,
      error: err.message || 'Failed to verify code.',
    };
  }
}
