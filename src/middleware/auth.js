import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } catch (error) {
            res.status(401).json({ message: "Not authorized, invalid token" });
        }
    } else {
        res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === "Admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Only Admins allowed." });
    }
};

export const isTasker = (req, res, next) => {
    if (req.user && req.user.role === "Tasker") {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Only Taskers allowed." });
    }
};

export const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
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
