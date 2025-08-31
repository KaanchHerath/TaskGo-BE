import { verifyToken } from "./auth.js";

// Jobs routes protection middleware - GET is public, other operations are protected
export const jobsRouteProtection = (req, res, next) => {
  if (req.method === 'GET') {
    next();
  } else {
    verifyToken(req, res, next);
  }
}; 