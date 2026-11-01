import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function getEmailDocId(email) {
  return String(email || '').trim().toLowerCase().replace(/\//g, '_');
}

function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';

  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  const k = [];

  let primeCounter = 0;
  const isPrime = (n) => {
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

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
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

export async function hashPassword(password) {
  const normalized = String(password || '').trim();
  const cryptoObj =
    typeof window !== 'undefined'
      ? window.crypto
      : typeof globalThis !== 'undefined'
      ? globalThis.crypto
      : null;

  if (cryptoObj && cryptoObj.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to pure JS SHA-256
    }
  }

  return sha256Sync(normalized);
}

export function generateVerificationCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

export async function dispatchVerificationCode(email, dbInstance) {
  try {
    const normalized = String(email || '').trim().toLowerCase();
    const docId = getEmailDocId(normalized);
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    const verRef = doc(dbInstance, 'emailVerifications', docId);
    await setDoc(verRef, {
      email: normalized,
      code,
      expiresAt,
      verified: false,
      createdAt: new Date().toISOString(),
    });

    try {
      await addDoc(collection(dbInstance, 'mail'), {
        to: [normalized],
        message: {
          subject: `Your UniSphere Verification Code: ${code}`,
          text: `Your UniSphere verification code is: ${code}\nThis code will expire in 15 minutes.`,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2>UniSphere Verification Code</h2><p>Here is your 6-digit verification code to confirm your email (<strong>${normalized}</strong>):</p><div style="font-size: 28px; letter-spacing: 6px; font-weight: bold; padding: 12px; border: 1px solid #333; text-align: center; margin: 16px 0;">${code}</div><p>This code will expire in 15 minutes.</p></div>`,
        },
        createdAt: serverTimestamp(),
      });
    } catch (mailErr) {
      console.warn('Firestore mail collection trigger skipped:', mailErr);
    }

    let emailSent = false;
    let providerNotice;

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, code }),
      });

      const resData = await response.json().catch(() => null);
      if (
        response.ok &&
        (resData?.id || resData?.data?.id || resData?.success || !resData?.error)
      ) {
        emailSent = true;
      } else if (resData?.configured === false) {
        providerNotice =
          resData.message || 'Email provider credentials not configured in environment.';
      } else if (resData?.error) {
        providerNotice =
          typeof resData.error === 'string' ? resData.error : resData.error.message;
      }
    } catch (netErr) {
      console.warn('Backend email dispatch request:', netErr);
    }

    return {
      success: true,
      expiresAt,
      emailSent,
      providerNotice,
    };
  } catch (err) {
    console.error('Error dispatching verification code:', err);
    return {
      success: false,
      expiresAt: 0,
      emailSent: false,
      error: err instanceof Error ? err.message : 'Failed to dispatch verification code.',
    };
  }
}

export async function verifyEmailCode(email, inputCode, dbInstance) {
  try {
    const normalized = String(email || '').trim().toLowerCase();
    const docId = getEmailDocId(normalized);
    const cleanCode = String(inputCode || '').trim();

    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Please enter the complete 6-digit verification code.' };
    }

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
        error: 'Incorrect verification code. Please check your email and try again.',
      };
    }

    await setDoc(verRef, { verified: true, verifiedAt: new Date().toISOString() }, { merge: true });

    try {
      const userRef = doc(dbInstance, 'users', docId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await setDoc(userRef, { emailVerified: true }, { merge: true });
      }
    } catch {}

    return { success: true };
  } catch (err) {
    console.error('Error validating verification code:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to verify code.',
    };
  }
}
