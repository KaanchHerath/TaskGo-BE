import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select("-password");
            next();
        } catch (error) {
            res.status(401).json({ message: "Not authorized, invalid token" });
        }
    } else {
        res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

// Optional authentication - tries to authenticate if token is present, but doesn't fail if not
export const optionalAuth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select("-password");
        } catch (error) {
            // Token is invalid, but we don't fail - just continue without user
            console.log("Invalid token provided, continuing without authentication");
            req.user = null;
        }
    }
    // Continue regardless of whether authentication succeeded
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

    // Fetch the full user document to ensure role and _id are available
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid token: user not found" });
    }

    req.user = user; // Ensures _id exists for downstream logic
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
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
