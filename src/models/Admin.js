import mongoose from "mongoose";
import User from "./User.js";

const adminSchema = new mongoose.Schema({
    permissions: [{ type: String, required: true }] // Example: ['MANAGE_USERS', 'VIEW_REPORTS']
});

const Admin = User.discriminator("Admin", adminSchema);
export default Admin;
