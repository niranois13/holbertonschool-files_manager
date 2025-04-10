import { Queue } from 'bull';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs/promises';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  try {
    const { fileId, userId } = job.data;

    if (!fileId) {
      throw new Error('Missing fileId');
    }

    if (!userId) {
      throw new Error('Missing userId');
    }

    const fileDocument = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });

    if (!fileDocument) {
      throw new Error('File not found');
    }

    const filePath = fileDocument.localPath;

    const sizes = [500, 250, 100];
    for (const width of sizes) {
      const options = { width };
      const thumbnail = await imageThumbnail(filePath, options);
      const thumbnailPath = `${filePath}_${width}`;
      await fs.writeFile(thumbnailPath, thumbnail);
    }

    done();
  } catch (error) {
    done(error);
  }
});
