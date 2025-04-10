const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs/promises');
const dbClient = require('./utils/db').default;

const fileQueue = new Queue('fileQueue');
fileQueue.process(async (job, done) => {
  try {
    const { fileId, userId } = job.data;
    console.log('fileQueue called...');
    if (!fileId) {
      throw new Error('Missing fileId');
    }
    if (!userId) {
      throw new Error('Missing userId');
    }
    console.log('fileId:', fileId, 'userId:', userId);

    const fileDocument = await dbClient.findFileByUserAndId(fileId, userId);
    console.log('fileDocument:', fileDocument);
    if (!fileDocument) {
      throw new Error('File not found');
    }

    const filePath = fileDocument.localPath;
    console.log('Generating thumbnails for:', filePath);

    const sizes = [500, 250, 100];
    await Promise.all(sizes.map(async (width) => {
      const options = { width };
      const thumbnail = await imageThumbnail(filePath, options);
      console.log('Thumbnail generated:', thumbnail);
      const thumbnailPath = `${filePath}_${width}`;
      await fs.writeFile(thumbnailPath, thumbnail);
    }));

    done();
  } catch (error) {
    done(error);
    console.error('Error in fileQueue:', error);
  }
});

module.exports = fileQueue;
