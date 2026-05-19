import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, LoadingSpinner } from '@reelbazaar/ui';
import type { User } from '@reelbazaar/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { SAMPLE_CREATORS, SAMPLE_BRANDS } from '../data/sampleProfiles';
import ChatModal from './ChatModal';

interface BrowseUsersModalProps {
  type: 'Creator' | 'Brand';
  onClose: () => void;
}

export default function BrowseUsersModal({
  type,
  onClose,
}: BrowseUsersModalProps) {
  const { user: currentUser, guestMode } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatUser, setChatUser] = useState<User | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [followPending, setFollowPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('persona', '==', type));
        const snapshot = await getDocs(q);
        const firestoreUsers = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as User)
          .filter((u) => u.id !== currentUser?.id);

        const samples = type === 'Creator' ? SAMPLE_CREATORS : SAMPLE_BRANDS;
        const firestoreIds = new Set(firestoreUsers.map((u) => u.id));
        const uniqueSamples = samples.filter((s) => !firestoreIds.has(s.id));

        setUsers([...firestoreUsers, ...uniqueSamples]);

        if (currentUser) {
          const followsSnap = await getDocs(
            query(
              collection(db, 'follows'),
              where('followerId', '==', currentUser.id),
            ),
          );
          const map: Record<string, boolean> = {};
          followsSnap.docs.forEach((d) => {
            map[d.data().followingId] = true;
          });
          setFollowingMap(map);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
        setUsers(type === 'Creator' ? SAMPLE_CREATORS : SAMPLE_BRANDS);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [type, currentUser?.id]);

  const handleFollow = async (targetUser: User) => {
    if (!currentUser || guestMode || followPending.has(targetUser.id)) return;

    const isFollowing = Boolean(followingMap[targetUser.id]);
    setFollowPending((prev) => new Set(prev).add(targetUser.id));
    setFollowingMap((prev) => ({ ...prev, [targetUser.id]: !isFollowing }));

    if (targetUser.id.startsWith('sample-')) {
      setFollowPending((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
      return;
    }

    try {
      const followRef = doc(
        db,
        'follows',
        `${currentUser.id}_${targetUser.id}`,
      );
      if (isFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: currentUser.id,
          followingId: targetUser.id,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setFollowingMap((prev) => ({ ...prev, [targetUser.id]: isFollowing }));
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  };

  const title = type === 'Creator' ? 'Creators' : 'Brands';

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <button onClick={onClose} className="p-1">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-base font-bold">{title}</h2>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="pt-20">
              <LoadingSpinner />
            </div>
          ) : users.length === 0 ? (
            <div className="pt-20 text-center text-white/50 text-sm">
              <p>No {title.toLowerCase()} found</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {users.map((user) => {
                const isFollowing = Boolean(followingMap[user.id]);
                const isSample = user.id.startsWith('sample-');
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <button
                      className="flex items-center flex-1 min-w-0 text-left"
                      onClick={() => {
                        if (!isSample) {
                          onClose();
                          navigate(`/profile/${user.id}`);
                        }
                      }}
                    >
                      <Avatar
                        name={user.username || user.name}
                        src={user.avatarUrl}
                        size="md"
                      />
                      <div className="ml-3 flex flex-col justify-center overflow-hidden pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[14px] truncate">
                            {user.username || user.name}
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              type === 'Brand'
                                ? 'bg-pink-500/20 text-pink-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {type}
                          </span>
                        </div>
                        <span className="text-[13px] text-white/50 truncate">
                          {user.name}
                        </span>
                        {user.brandName && (
                          <span className="text-[12px] text-white/40 truncate">
                            {user.brandName}
                          </span>
                        )}
                        {user.interests && user.interests.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {user.interests.slice(0, 3).map((i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40"
                              >
                                {i}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleFollow(user)}
                        disabled={followPending.has(user.id)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                          isFollowing
                            ? 'bg-[#333] text-white hover:bg-[#444]'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                      {!guestMode && currentUser && (
                        <button
                          onClick={() => setChatUser(user)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {chatUser && (
        <ChatModal otherUser={chatUser} onClose={() => setChatUser(null)} />
      )}
    </>
  );
}
