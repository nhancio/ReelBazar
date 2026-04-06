import { createContext, useContext } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  appUser: any;
  token: string | null;
  register: (data: any) => Promise<void>;
  signOut: () => Promise<void>;
  apiUrl: string;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  token: null,
  register: async () => {},
  signOut: async () => {},
  apiUrl: '',
});

export const useAuth = () => useContext(AuthContext);
