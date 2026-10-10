import jwt from 'jsonwebtoken';
import { one } from './store.js';

const cookieName = 'academia_session';

export function signSession(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET || 'dev-only-secret', { expiresIn: '8h' });
}

export function setSessionCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName);
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[cookieName] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Debes iniciar sesión.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-secret');
    const user = await one('users', { _id: payload.sub });
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'La cuenta no está disponible.' });
    req.auth = { ...payload, role: user.role };
    req.currentUser = user;
    next();
  } catch {
    return res.status(401).json({ message: 'La sesión expiró. Inicia sesión nuevamente.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.auth.role)
    ? next()
    : res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
}
