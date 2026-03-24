import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const register = async (email, password, name, phone) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email immediately after registration
    await sendEmailVerification(cred.user);
    const profile = { name, email, phone, role: 'passenger', createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    setUserProfile(profile);
    return cred;
  };

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Block login if email not verified
    if (!cred.user.emailVerified) {
      await signOut(auth);
      throw new Error('EMAIL_NOT_VERIFIED');
    }
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    const profile = userDoc.exists() ? userDoc.data() : null;
    if (profile) setUserProfile(profile);
    return { cred, role: profile?.role || 'passenger' };
  };

  const logout = () => signOut(auth);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const changePassword = async (currentPassword, newPassword) => {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const resendVerificationEmail = async () => {
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    }
  };

  const getToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const isAdmin = userProfile?.role === 'admin';
  const adminCity = userProfile?.adminCity || null;
  const isSuperAdmin = isAdmin && !adminCity;

  const value = { user, userProfile, loading, register, login, logout, resetPassword, changePassword, resendVerificationEmail, getToken, isAdmin, adminCity, isSuperAdmin };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
