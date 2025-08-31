import mongoose from "mongoose";
import User from "./User.js";

const adminSchema = new mongoose.Schema({
    permissions: [{ type: String, required: true }] 
});

const Admin = User.discriminator("Admin", adminSchema);
export default Admin;
