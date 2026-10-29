import mongoose from 'mongoose';
import { env } from './env';

let memoryServer: any = null;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log(`[DB] Attempting connection to configured MongoDB URI...`);
      const conn = await mongoose.connect(uri);
      console.log(`[DB] Successfully connected to MongoDB at: ${conn.connection.host}`);
      return conn;
    } catch {
      console.error('[DB] Configured MongoDB connection failed. Check MONGODB_URI and database availability.');
      throw new Error('Configured MongoDB connection failed.');
    }
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production; refusing to start with an in-memory database.');
  }

  // The embedded database is reserved for local development and tests.
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    console.log(`[DB] Starting embedded MongoMemoryServer at: ${memUri}`);
    const conn = await mongoose.connect(memUri);
    console.log(`[DB] Successfully connected to embedded MongoMemoryServer!`);
    return conn;
  } catch (err: any) {
    console.error(`[DB] Critical Error: Unable to connect to MongoDB or start MongoMemoryServer: ${err.message}`);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
