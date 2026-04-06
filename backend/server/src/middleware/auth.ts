import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken, db } from '../utils/firebase';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
      };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = await verifyFirebaseToken(token);

  if (!decoded) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const usersRef = db().collection('users');
  
  // 1. Try direct fetch by firebaseUid as document ID (Fastest)
  let userDoc = await usersRef.doc(decoded.uid).get();
  
  // 2. Fallback to 'where' query for legacy users
  if (!userDoc.exists) {
    const snapshot = await usersRef.where('firebaseUid', '==', decoded.uid).limit(1).get();
    if (!snapshot.empty) {
      userDoc = snapshot.docs[0];
    }
  }

  if (!userDoc.exists) {
    // User not yet registered — allow auth routes to handle registration
    req.user = { id: '', firebaseUid: decoded.uid };
    return next();
  }

  req.user = { id: userDoc.id, firebaseUid: decoded.uid };
  next();
}

export function requireRegistered(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(403).json({ message: 'User not registered' });
  }
  next();
}

