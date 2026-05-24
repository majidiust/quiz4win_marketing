import mongoose from "mongoose";
import { env } from "./env";

// Cached connection across hot reloads and serverless invocations.
declare global {
  // eslint-disable-next-line no-var
  var __mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

const cached = global.__mongoose ?? { conn: null, promise: null };
if (!global.__mongoose) {
  global.__mongoose = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = env.mongodbUri();
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
