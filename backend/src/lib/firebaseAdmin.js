import admin from 'firebase-admin';

function adminServiceAccount() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

function requireAdminServiceAccount() {
  const serviceAccount = adminServiceAccount();

  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin service account is missing. Add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to backend/.env.'
    );
  }

  return serviceAccount;
}

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = requireAdminServiceAccount();

    admin.initializeApp({
      projectId: serviceAccount.projectId,
      credential: admin.credential.cert(serviceAccount)
    });
  }

  return admin;
}

export async function verifyFirebaseToken(idToken) {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().verifyIdToken(idToken);
}

export async function createFirebaseSessionCookie(idToken, expiresIn) {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().createSessionCookie(idToken, { expiresIn });
}

export async function verifyFirebaseSession(sessionCookie) {
  const firebaseAdmin = getFirebaseAdmin();

  try {
    return await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
  } catch {
    return firebaseAdmin.auth().verifyIdToken(sessionCookie);
  }
}

export async function firebaseUserExists(email) {
  const firebaseAdmin = getFirebaseAdmin();

  try {
    return await firebaseAdmin.auth().getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  }
}

export async function createVerifiedFirebaseUser({ email, password, displayName }) {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().createUser({
    email,
    password,
    displayName,
    emailVerified: true
  });
}

export async function ensureVerifiedFirebaseUser({ email, password, displayName }) {
  const firebaseAdmin = getFirebaseAdmin();
  const existing = await firebaseUserExists(email);

  if (!existing) {
    return firebaseAdmin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });
  }

  return firebaseAdmin.auth().updateUser(existing.uid, {
    password,
    displayName,
    emailVerified: true
  });
}

export async function createFirebaseCustomToken(uid) {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().createCustomToken(uid);
}

export async function updateFirebaseUserPassword(email, password) {
  const user = await firebaseUserExists(email);
  if (!user) return null;

  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().updateUser(user.uid, {
    password,
    emailVerified: true
  });
}
