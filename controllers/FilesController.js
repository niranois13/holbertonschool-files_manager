const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { xTokenHandler } = require('./AuthController');
const dbClient = require('../utils/db').default;

module.exports = {
  async contentTypeHandler(req) {
    try {
      if (!req.is('application/json')) {
        throw new Error('Invalid Content-Type');
      }
      return req.body;
    } catch (error) {
      console.error('Error in contentTypeHandler:', error.message);
      return null;
    }
  },

  async saveToDisk(data) {
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

    try {
      await fs.promises.mkdir(folderPath, { recursive: true });

      const filePath = path.join(folderPath, uuidv4());
      const buffer = Buffer.from(data, 'base64');
      await fs.promises.writeFile(filePath, buffer);

      return filePath;
    } catch (error) {
      console.error('Error saving file to disk:', error);
      throw new Error('Error saving file to disk');
    }
  },

  async postUpload(req, res) {
    try {
      console.log('Checking user token...');
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('User authorized:', userId);

      console.log('Handling content...');
      const content = await this.contentTypeHandler(req);
      if (!content) {
        return res.status(400).json({ error: 'Missing content' });
      }
      console.log('Incoming content:', content);

      if (!content.name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      const acceptedTypes = ['folder', 'file', 'image'];
      if (!acceptedTypes.includes(content.type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (!content.parentId) {
        content.parentId = 0;
        console.log('No parentId provided, defaulting to root (0)');
      } else {
        try {
          console.log('Looking up parent folder:', content.parentId);
          const parentObject = await dbClient.findFileById(content.parentId);
          if (!parentObject) {
            return res.status(400).json({ error: 'Parent not found' });
          }
          if (parentObject.type !== 'folder') {
            return res.status(400).json({ error: 'Parent is not a folder' });
          }
        } catch (error) {
          console.error('Error while searching for parent:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      }

      if (typeof content.isPublic !== 'boolean') {
        content.isPublic = false;
      }

      const dataTypes = ['file', 'image'];
      if (!content.data && dataTypes.includes(content.type)) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (content.type !== 'folder') {
        console.log('Saving file to disk...');
        const filePath = await this.saveToDisk(content.data);
        if (!filePath) {
          return res.status(500).json({ error: 'Failed to save file on disk' });
        }
        console.log('File saved to:', filePath);
        content.localPath = filePath;
      }

      try {
        content.userId = new ObjectId(userId);
      } catch (err) {
        console.error('Invalid userId format:', userId);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileToInsert = {
        name: content.name,
        type: content.type,
        isPublic: content.isPublic,
        parentId: content.parentId,
        userId: content.userId,
        localPath: content.localPath,
      };

      console.log('Preparing to insert into DB:', fileToInsert);

      const newFile = await dbClient.createFile(fileToInsert);
      if (!newFile) {
        console.error('createFile returned null');
        return res.status(500).json({ error: 'DB insertion returned null' });
      }

      console.log('File inserted into DB:', newFile);
      return res.status(201).json({
        id: newFile.id || newFile._id,
        userId: newFile.userId,
        name: newFile.name,
        type: newFile.type,
        isPublic: newFile.isPublic,
        parentId: newFile.parentId.toString(),
      });
    } catch (error) {
      console.error('Error in postUpload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
