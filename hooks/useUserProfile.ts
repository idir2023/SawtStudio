import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export interface UserProfile {
  email: string;
  role: 'admin' | 'user';
  subscriptionTier: 'free' | 'pro';
  generationsCount: number;
  createdAt: any;
}

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTimeout(() => {
        setProfile(null);
        setLoading(false);
      }, 0);
      return;
    }

    const userRef = doc(db, 'users', user.uid);

    const initializeProfile = async () => {
      try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
          // Create default profile
          const isDefaultAdmin = user.email === 'lahcenidir72@gmail.com';
          const newProfile: UserProfile = {
            email: user.email || '',
            role: isDefaultAdmin ? 'admin' : 'user',
            subscriptionTier: isDefaultAdmin ? 'pro' : 'free',
            generationsCount: 0,
            createdAt: serverTimestamp(),
          };
          
          await setDoc(userRef, newProfile);
          // Profile will be set by the onSnapshot listener
        }
      } catch (error) {
        console.error("Error initializing user profile:", error);
      }
    };

    initializeProfile();

    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { profile, loading };
}
