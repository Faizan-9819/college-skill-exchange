import { Schema, model, models } from "mongoose";

const exchangeRequestSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    skill: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
    },

    message: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Completed"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

if (models && models.ExchangeRequest) {
  delete (models as any).ExchangeRequest;
}

const ExchangeRequest =
  models.ExchangeRequest || model("ExchangeRequest", exchangeRequestSchema);

export default ExchangeRequest;
