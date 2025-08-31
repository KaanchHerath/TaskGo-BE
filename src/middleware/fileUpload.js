import fileUpload from "express-fileupload";

// File upload middleware configuration
export const fileUploadMiddleware = fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached"
}); 