import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { connectDB } from '../src/config/db';

describe('database startup', () => {
  const originalMongoUri = env.MONGODB_URI;

  afterEach(() => {
    env.MONGODB_URI = originalMongoUri;
    vi.restoreAllMocks();
  });

  it('does not silently switch to an in-memory database when configured MongoDB is unavailable', async () => {
    env.MONGODB_URI = 'mongodb://configured.invalid:27017/swasthya';
    const connect = vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('connection refused'));

    await expect(connectDB()).rejects.toThrow('Configured MongoDB connection failed.');
    expect(connect).toHaveBeenCalledOnce();
  });
});
