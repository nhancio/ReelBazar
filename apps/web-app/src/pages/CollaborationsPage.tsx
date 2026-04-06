import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collaborationsApi } from '@reelbazaar/api';
import { Avatar, UserTypeBadge, Button, LoadingSpinner } from '@reelbazaar/ui';
import { useAuth } from '../context/AuthContext';
import type { Collaboration } from '@reelbazaar/config';
import { demoCollaborations } from '../demoData';

export default function CollaborationsPage() {
  const { user, guestMode } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Collaboration[]>([]);
  const [myCollabs, setMyCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'suggestions' | 'active'>('suggestions');

  useEffect(() => {
    const load = async () => {
      try {
        if (guestMode) {
          setSuggestions(demoCollaborations.filter((collab) => collab.status === 'suggested'));
          setMyCollabs(demoCollaborations);
          return;
        }
        const [suggestionsRes, collabsRes] = await Promise.all([
          collaborationsApi.getSuggestions(),
          collaborationsApi.getMyCollaborations(),
        ]);
        setSuggestions(suggestionsRes.collaborations);
        setMyCollabs(collabsRes.collaborations);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [guestMode]);

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    if (guestMode) {
      const target = suggestions.find((collab) => collab.id === id);
      setSuggestions((prev) => prev.filter((collab) => collab.id !== id));
      if (status === 'accepted' && target) {
        setMyCollabs((prev) => [...prev, { ...target, status: 'accepted' }]);
      }
      return;
    }
    try {
      const { collaboration } = await collaborationsApi.respond(id, status);
      setSuggestions((prev) => prev.filter((c) => c.id !== id));
      if (status === 'accepted') {
        setMyCollabs((prev) => [...prev, collaboration]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="rb-page pt-20"><LoadingSpinner /></div>;

  const isBrand = user?.userType === 'brand';

  return (
    <div className="rb-page">
      <div className="mb-5 px-1">
        <p className="text-sm font-medium text-slate-500">Matching</p>
        <h1 className="rb-title text-[2rem]">Collaborations</h1>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab('suggestions')}
          className={`rb-chip ${tab === 'suggestions' ? 'rb-chip-active' : ''}`}
        >
          Suggested ({suggestions.length})
        </button>
        <button
          onClick={() => setTab('active')}
          className={`rb-chip ${tab === 'active' ? 'rb-chip-active' : ''}`}
        >
          Active ({myCollabs.filter((c) => c.status === 'accepted').length})
        </button>
      </div>

      {tab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="rb-card mt-10 px-6 py-10 text-center text-slate-500">No suggestions yet</div>
          ) : (
            suggestions.map((collab) => {
              const other = isBrand ? collab.influencer : collab.brand;
              if (!other) return null;
              return (
                <div key={collab.id} className="rb-card flex items-center gap-3 px-4 py-4">
                  <Avatar name={other.name} src={other.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{other.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {other.userType && <UserTypeBadge type={other.userType as any} />}
                      <span className="text-xs text-slate-500">
                        Match: {Math.round(collab.score)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button size="sm" onClick={() => handleRespond(collab.id, 'accepted')}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRespond(collab.id, 'declined')}>
                      Pass
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-3">
          {myCollabs.filter((c) => c.status === 'accepted').length === 0 ? (
            <div className="rb-card mt-10 px-6 py-10 text-center text-slate-500">No active collaborations</div>
          ) : (
            myCollabs
              .filter((c) => c.status === 'accepted')
              .map((collab) => {
                const other = isBrand ? collab.influencer : collab.brand;
                if (!other) return null;
                return (
                  <div key={collab.id} className="rb-card flex items-center gap-3 px-4 py-4">
                    <Avatar name={other.name} src={other.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{other.name}</p>
                      {other.userType && <UserTypeBadge type={other.userType as any} />}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const convId = [user!.id, other.id].sort().join('_');
                        navigate(`/messages/${convId}`);
                      }}
                    >
                      Chat
                    </Button>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
