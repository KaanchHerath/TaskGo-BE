import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../utils/logger.js";


export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select("-password");
            next();
        } catch (error) {
            logger.auth('Invalid token attempt', req.ip);
            res.status(401).json({ message: "Not authorized, invalid token" });
        }
    } else {
        logger.auth('No token provided', req.ip);
        res.status(401).json({ message: "Not authorized, no token provided" });
    }
};
export const optionalAuth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select("-password");
        } catch (error) {
            req.user = null;
        }
    }
    next();
};

export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Only Admins allowed." });
    }
};

export const isTasker = (req, res, next) => {
    if (req.user && req.user.role === "tasker") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Only Taskers allowed." });
    }
};

export const verifyToken = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

   
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid token: user not found" });
    }

    req.user = user; 
    next();
  } catch (error) {
   
    res.status(401).json({ message: "Invalid token" });
  }
};

export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    next();
  };
};
