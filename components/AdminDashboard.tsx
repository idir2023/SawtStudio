import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '@/hooks/useUserProfile';
import { Button } from '@/components/ui/button';
import { Crown, Shield, User as UserIcon, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
}

interface UserWithId extends UserProfile {
  id: string;
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const showAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserWithId[];
      
      // Sort admins first, then by creation date
      fetchedUsers.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleRole = async (user: UserWithId) => {
    setUpdatingId(user.id);
    try {
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      await updateDoc(doc(db, 'users', user.id), {
        role: newRole
      });
    } catch (error) {
      console.error("Error updating role:", error);
      showAlert("Error", "Failed to update role.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSubscription = async (user: UserWithId) => {
    setUpdatingId(user.id);
    try {
      const newTier = user.subscriptionTier === 'pro' ? 'free' : 'pro';
      await updateDoc(doc(db, 'users', user.id), {
        subscriptionTier: newTier
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      showAlert("Error", "Failed to update subscription.");
    } finally {
      setUpdatingId(null);
    }
  };

  const resetGenerations = async (user: UserWithId) => {
    showConfirm(
      "Reset Generations",
      `Are you sure you want to reset generations for ${user.email}?`,
      async () => {
        setUpdatingId(user.id);
        try {
          await updateDoc(doc(db, 'users', user.id), {
            generationsCount: 0
          });
        } catch (error) {
          console.error("Error resetting generations:", error);
          showAlert("Error", "Failed to reset generations.");
        } finally {
          setUpdatingId(null);
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[80vh] bg-[#151619] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-500" />
            Admin Dashboard
          </h2>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/10">
            Close Dashboard
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
              Loading users...
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="text-xs text-white/50 uppercase bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium">Usage</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-white/70" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{u.email}</div>
                            <div className="text-xs text-white/40 font-mono mt-0.5">{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/10 text-white/70 border border-white/10'
                        }`}>
                          {u.role === 'admin' && <Shield className="w-3 h-3" />}
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.subscriptionTier === 'pro' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-white/70 border border-white/10'
                        }`}>
                          {u.subscriptionTier === 'pro' && <Crown className="w-3 h-3" />}
                          {u.subscriptionTier.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${u.generationsCount >= 100 && u.subscriptionTier === 'free' ? 'text-red-400' : 'text-white'}`}>
                            {u.generationsCount}
                          </span>
                          <span className="text-white/40 text-xs">
                            {u.subscriptionTier === 'free' ? '/ 100' : '/ ∞'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updatingId === u.id}
                          onClick={() => toggleRole(u)}
                          className="border-white/10 text-white hover:bg-white/10 text-xs h-8"
                        >
                          {updatingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (u.role === 'admin' ? 'Make User' : 'Make Admin')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updatingId === u.id}
                          onClick={() => toggleSubscription(u)}
                          className="border-white/10 text-white hover:bg-white/10 text-xs h-8"
                        >
                          {updatingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (u.subscriptionTier === 'pro' ? 'Make Free' : 'Make Pro')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updatingId === u.id}
                          onClick={() => resetGenerations(u)}
                          title="Reset Usage"
                          className="border-white/10 text-white hover:bg-white/10 text-xs h-8 w-8 p-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-white/50">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Custom Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#151619] border border-white/10 rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <h3 className="text-lg font-bold text-white">{modalState.title}</h3>
            </div>
            <p className="text-white/70 mb-6">{modalState.message}</p>
            <div className="flex justify-end gap-3">
              {modalState.type === 'confirm' && (
                <Button variant="outline" onClick={closeModal} className="border-white/10 text-white hover:bg-white/10">
                  Cancel
                </Button>
              )}
              <Button 
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) {
                    modalState.onConfirm();
                  }
                  closeModal();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-medium"
              >
                {modalState.type === 'confirm' ? 'Confirm' : 'OK'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
