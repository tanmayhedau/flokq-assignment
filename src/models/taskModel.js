const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      require: true,
    },
    result: {
      type: String,
    },
    jobId: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("task-queue", taskSchema);
