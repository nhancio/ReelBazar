import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoadingSpinner } from '@reelbazaar/ui';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import CreateReelPage from './pages/CreateReelPage';
import ProfilePage from './pages/ProfilePage';
import CollaborationsPage from './pages/CollaborationsPage';
import SingleReelPage from './pages/SingleReelPage';

export default function App() {
  const { firebaseUser, loading, isRegistered, guestMode } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-white items-center justify-center px-6">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-[13px] font-semibold text-gray-500">Loading ReelBazaar...</p>
      </div>
    );
  }

  // Not logged in
  if (!firebaseUser && !guestMode) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  // Logged in but not registered (waiting for auto-registration)
  if (!isRegistered && !guestMode) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full bg-white items-center justify-center px-6">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-[13px] font-semibold text-gray-500">Setting up your profile...</p>
      </div>
    );
  }

  // Fully authenticated
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/reel/:reelId" element={<SingleReelPage />} />
          <Route path="/create" element={<CreateReelPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/collaborations" element={<CollaborationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
