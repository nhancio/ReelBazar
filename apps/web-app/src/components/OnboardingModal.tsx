import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '@reelbazaar/api';
import { Button } from '@reelbazaar/ui';

const OPTIONS = ['Electronics', 'Fashion', 'Beauty', 'Lifestyle'];

export default function OnboardingModal() {
  const { user, guestMode, refreshUser } = useAuth();
  
  // Only show if logged in, NOT in guest mode, and hasn't set up profile
  const shouldShow = user && !guestMode && (!user.productCategories || user.productCategories.length === 0);
  
  const [username, setUsername] = useState(user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!shouldShow) return null;

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || selectedInterests.length === 0) return;
    
    setLoading(true);
    try {
      await usersApi.updateProfile({
        name: username.toLowerCase().replace(/\s+/g, ''),
        productCategories: selectedInterests,
      });
      // Refresh context user to hide modal and sync changes
      await refreshUser();
    } catch (err) {
      console.error('Failed to update profile', err);
      alert('Failed to save profile details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-[32px] bg-black border border-white/20 p-8 animate-in zoom-in-95 duration-200">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to ReelBazaar! 👋</h2>
        <p className="text-sm text-white/70 mb-8">Let's set up your profile quickly.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2 ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
              placeholder="e.g. fashionguru"
              className="w-full rounded-2xl bg-white/10 border border-white/10 px-5 py-4 text-white text-lg placeholder:text-white/20 focus:border-white/40 focus:bg-white/15 focus:outline-none transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-3 ml-1">What are you interested in?</label>
            <div className="flex flex-wrap gap-2.5">
              {OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleInterest(opt)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${
                    selectedInterests.includes(opt)
                      ? 'bg-white text-black border-white scale-105'
                      : 'bg-transparent text-white/60 border-white/10 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {selectedInterests.length === 0 && (
              <p className="text-red-400 text-xs mt-2">Please select at least one interest.</p>
            )}
          </div>

          <Button 
            type="submit" 
            fullWidth 
            loading={loading}
            disabled={!username.trim() || selectedInterests.length === 0}
            className="mt-4"
          >
            Save & Continue
          </Button>
        </form>
      </div>
    </div>
  );
}