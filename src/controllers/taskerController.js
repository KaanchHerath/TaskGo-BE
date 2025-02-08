import Tasker from "../models/Tasker.js";

export const getAllTaskers = async (req, res) => {
    try {
        const taskers = await Tasker.find();
        res.json(taskers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateTaskerAvailability = async (req, res) => {
    const { availability } = req.body;
    try {
        const tasker = await Tasker.findByIdAndUpdate(req.user.id, { availability }, { new: true });
        res.json(tasker);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
