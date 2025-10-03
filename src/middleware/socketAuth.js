import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user to socket
 */
export const socketAuth = async (socket, next) => {
  try {
    const auth = socket.handshake?.auth || {};
    const headerAuth = socket.handshake?.headers?.authorization;
    const query = socket.handshake?.query || {};

    const tokenFromAuth = auth.token || auth.accessToken;
    const tokenFromHeader = headerAuth && headerAuth.startsWith('Bearer ')
      ? headerAuth.slice(7)
      : undefined;
    const tokenFromQuery = query.token;

    const token = tokenFromAuth || tokenFromHeader || tokenFromQuery;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: Invalid user'));
    }
    
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};


