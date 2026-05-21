import { useState, useEffect, useRef } from 'react';
import { Avatar } from '@reelbazaar/ui';
import type { User } from '@reelbazaar/config';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collaborationsApi } from '@reelbazaar/api';

interface ChatModalProps {
  otherUser: User;
  onClose: () => void;
  dealContext?: {
    brandId: string;
    influencerId: string;
    productListingId?: string;
  };
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export default function ChatModal({ otherUser, onClose, dealContext }: ChatModalProps) {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [dealPending, setDealPending] = useState<'accepted' | 'declined' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversationId = currentUser
    ? getConversationId(currentUser.id, otherUser.id)
    : null;

  useEffect(() => {
    if (!conversationId) return;

    const messagesRef = collection(
      db,
      'conversations',
      conversationId,
      'messages',
    );
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Message[];
        setMessages(msgs);
      },
      (error) => {
        console.error('Error listening to messages:', error);
      },
    );

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || !conversationId || sending) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await setDoc(
        doc(db, 'conversations', conversationId),
        {
          participants: [currentUser.id, otherUser.id],
          lastMessage: text,
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await addDoc(
        collection(db, 'conversations', conversationId, 'messages'),
        {
          senderId: currentUser.id,
          text,
          createdAt: new Date().toISOString(),
        },
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleDeal = async (status: 'accepted' | 'declined') => {
    if (!currentUser || !conversationId || !dealContext || dealPending) return;
    setDealPending(status);
    try {
      await collaborationsApi.setDeal({
        ...dealContext,
        status,
        conversationId,
      });
    } catch (err) {
      console.error('Failed to update deal status:', err);
    } finally {
      setDealPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white animate-in slide-in-from-right">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
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
        <Avatar
          name={otherUser.username || otherUser.name}
          src={otherUser.avatarUrl}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {otherUser.username || otherUser.name}
          </p>
          <p className="text-xs text-white/50 truncate">
            {otherUser.persona || 'User'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-white/30 text-sm pt-20">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Say hello!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-white/10 text-white rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {dealContext && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mx-auto flex w-full max-w-xs items-center gap-2 rounded-full border border-white/10 bg-black/80 p-1.5 shadow-2xl backdrop-blur-sm">
            <button
              type="button"
              disabled={Boolean(dealPending)}
              onClick={() => handleDeal('accepted')}
              className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {dealPending === 'accepted' ? 'Saving...' : 'Deal'}
            </button>
            <button
              type="button"
              disabled={Boolean(dealPending)}
              onClick={() => handleDeal('declined')}
              className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {dealPending === 'declined' ? 'Saving...' : 'No Deal'}
            </button>
          </div>
        </div>
      )}

      <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:bg-white/15"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-blue-500 rounded-full disabled:opacity-40 transition-opacity"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
