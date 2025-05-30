const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const { xTokenHandler } = require('./AuthController');
const dbClient = require('../utils/db').default;
const fileQueue = require('../worker');

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
      }

      if (content.parentId !== 0) {
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

      try {
        content.userId = new ObjectId(userId);
      } catch (err) {
        console.error('Invalid userId format:', userId);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (content.type !== 'folder') {
        console.log('Saving file to disk...');
        const filePath = await this.saveToDisk(content.data);
        if (!filePath) {
          return res.status(500).json({ error: 'Failed to save file on disk' });
        }
        content.localPath = filePath;

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
        if (content.type === 'image') {
          console.log('Adding to fileQueue:', newFile._id, newFile.userId);
          await fileQueue.add({ fileId: newFile._id, userId: newFile.userId });
        }
        console.log('File saved to:', filePath);

        console.log('File inserted into DB:', newFile);

        return res.status(201).json({
          id: newFile._id,
          userId: newFile.userId,
          name: newFile.name,
          type: newFile.type,
          isPublic: newFile.isPublic,
          parentId: newFile.parentId.toString(),
        });
      }
      const folderToInsert = {
        name: content.name,
        type: content.type,
        parentId: content.parentId,
        userId: content.userId,
      };
      console.log('Preparing to insert into DB:', folderToInsert);
      const newFolder = await dbClient.createFolder(folderToInsert);

      return res.status(201).json({
        id: newFolder._id,
        userId: newFolder.userId,
        name: newFolder.name,
        type: newFolder.type,
        isPublic: false,
        parentId: newFolder.parentId,
      });
    } catch (error) {
      console.error('Error in postUpload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getShow(req, res) {
    try {
      console.log('getShow - Checking user token...');
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('gestShow - User authorized:', userId);
      const fileId = req.params.id;
      console.log('getShow - fileId:', fileId, 'userId:', userId);
      const userFile = await dbClient.findFileByUserAndId(fileId, userId);
      if (!userFile) {
        console.log('getShow - userFile:', userFile);
        return res.status(404).json({ error: 'Not found' });
      }
      console.log('getShow - userFiles:', userFile);
      return res.status(200).json({
        id: userFile._id.toString(),
        userId: userFile.userId.toString(),
        name: userFile.name,
        type: userFile.type,
        isPublic: userFile.isPublic,
        parentId: userFile.parentId.toString(),
      });
    } catch (error) {
      console.error('Error in getShow:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getIndex(req, res) {
    try {
      console.log('getIndex - Checking user token...');
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('getIndex - User authorized:', userId);

      const { parentId } = req.query;
      let { page } = req.query;
      page = parseInt(page, 10) || 0;
      if (!page || Number.isNaN(page) || page < 0) {
        page = 0;
      }

      console.log('parentId:', parentId);

      if (!parentId) {
        console.log('Calling findFilesByUser with userId:', userId);
        const userFile = await dbClient.findFilesByUserId(userId, page);
        if (!userFile) {
          return res.status(404).json({ error: 'Not found' });
        }

        const formattedFiles = userFile.map((file) => ({
          id: file._id.toString(),
          userId: file.userId.toString(),
          name: file.name,
          type: file.type,
          isPublic: file.isPublic || false,
          parentId: file.parentId.toString(),
        }));

        console.log('formattedFiles:', formattedFiles);
        console.log('Number of files:', formattedFiles.length);
        return res.status(200).json(formattedFiles);
      }

      console.log('Calling findFilesByParentId:');
      console.log('page:', page, 'typeof(page):', typeof (page));
      console.log('parentId:', parentId, 'typeof(parentId):', typeof (parentId));
      console.log('userId:', userId, 'typeof(userId):', typeof (userId));
      const userFile = await dbClient.findFilesByParentId(parentId, userId, page);
      if (!userFile) {
        return res.status(404).json({ error: 'Not found' });
      }

      const formattedFiles = userFile.map((file) => ({
        id: file._id.toString(),
        userId: file.userId.toString(),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic || false,
        parentId: userFile.parentId === '0' ? 0 : userFile.parentId.toString(),
      }));

      console.log(`Number of formatted files: ${formattedFiles.length}`);
      return res.status(200).json(formattedFiles);
    } catch (error) {
      console.error('Error in getIndex:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async putPublish(req, res) {
    try {
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      if (!fileId) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userFile = await dbClient.publishFile(fileId, userId);
      if (!userFile) {
        return res.status(404).json({ error: 'Not found' });
      }
      console.log('Sending response:', {
        id: userFile._id.toString(),
        userId: userFile.userId.toString(),
        name: userFile.name,
        type: userFile.type,
        isPublic: userFile.isPublic,
        parentId: userFile.parentId === '0' ? 0 : userFile.parentId.toString(),
      });
      return res.status(200).json({
        id: userFile._id.toString(),
        userId: userFile.userId.toString(),
        name: userFile.name,
        type: userFile.type,
        isPublic: userFile.isPublic,
        parentId: userFile.parentId === '0' ? 0 : userFile.parentId.toString(),
      });
    } catch (error) {
      console.error('Error in putPublish:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async putUnpublish(req, res) {
    try {
      console.log('putUnpublish - Checking user token...');
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('putUnpublish - User authorized:', userId);

      const fileId = req.params.id;
      if (!fileId) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userFile = await dbClient.unpublishFile(fileId, userId);
      if (!userFile) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json({
        id: userFile._id.toString(),
        userId: userFile.userId.toString(),
        name: userFile.name,
        type: userFile.type,
        isPublic: userFile.isPublic,
        parentId: userFile.parentId === '0' ? 0 : userFile.parentId.toString(),
      });
    } catch (error) {
      console.error('Error in putUnpublish:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getFile(req, res) {
    try {
      console.log('Entering getFile...');
      const fileId = req.params.id;
      if (!fileId) {
        return res.status(400).json({ error: 'Bad request' });
      }

      const reqUserId = await xTokenHandler(req, res);

      const fileContent = await dbClient.findDataById(fileId, reqUserId);
      console.log('fileContent:', fileContent);
      if (fileContent === 'No file found') {
        return res.status(404).json({ error: 'Not found' });
      }
      if (fileContent === 'Folder found') {
        return res.status(400).json({ error: 'A folder doesn\'t have content' });
      }
      res.setHeader('Content-Type', fileContent.mime);
      return res.status(200).send(fileContent.data);
    } catch (error) {
      console.error('Error in getFile:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
