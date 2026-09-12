import { Schema, model, models } from "mongoose";

const skillSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

if (models && models.Skill) {
  delete (models as any).Skill;
}

const Skill = models.Skill || model("Skill", skillSchema);

export default Skill;
