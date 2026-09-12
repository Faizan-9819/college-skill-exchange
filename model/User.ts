import mongoose, { Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: false,
      default: "",
    },

    department: {
      type: String,
      required: false,
      default: "",
    },

    year: {
      type: Number,
      required: false,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

if (models && models.User) {
  delete (models as any).User;
}

const User = models.User || model("User", userSchema);

export default User;
