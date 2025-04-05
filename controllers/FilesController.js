const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
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
      return null;
    }
  },

  async createFolderEntry({ name, owner, parentId = 0, isPublic = false }) {
    const folderData = {
      name,
      type: 'folder',
      isPublic,
      parentId,
      owner,
    };

    try {
      const newFolder = await dbClient.createFile(folderData);
      return {
        id: newFolder._id,
        userId: newFolder.owner,
        name: newFolder.name,
        type: newFolder.type,
        isPublic: newFolder.isPublic,
        parentId: newFolder.parentId,
      };
    } catch (error) {
      console.error('Error in createFolderEntry:', error);
      return null;
    }
  },

  async postUpload(req, res) {
    try {
      const userId = await xTokenHandler(req, res);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const content = await this.contentTypeHandler(req);
      if (!content) {
        return res.status(400).json({ error: 'Missing content' });
      }

      if (!content.name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      const acceptedTypes = ['folder', 'file', 'image'];
      if (!acceptedTypes.includes(content.type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (!content.parentId) {
        content.parentId = 0;
      } else {
        try {
          const parentObject = await dbClient.findFileById(content.parentId);
          if (!parentObject) {
            return res.status(400).json({ error: 'Parent not found' });
          }
          if (parentObject.type !== 'folder') {
            return res.status(400).json({ error: 'Parent is not a folder' });
          }
        } catch (error) {
          console.error('Error while searching for Parent:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
      }

      if (!content.isPublic) {
        content.isPublic = false;
      }

      const dataTypes = ['file', 'image'];
      if (!content.data && dataTypes.includes(content.type)) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (typeof content.isPublic !== 'boolean') {
        return res.status(400).json({ error: 'isPublic must be true or false' });
      }

      content.owner = userId;

      if (content.type !== 'folder') {
        const filePath = await this.saveToDisk(content.data);
        if (!filePath) {
          return res.status(500).json({ error: 'Failed to save file on disk' });
        }
        content.localPath = filePath;
      } else {
        const folderResponse = await createFolderEntry({
          name: content.name,
          owner: userId,
          parentId: content.parentId,
          isPublic: content.isPublic,
        });

        if (!folderResponse) {
          return res.status(500).json({ error: 'Could not create folder' });
        }

        return res.status(201).json(folderResponse);
      }

      const newFile = await dbClient.createFile(content);
      return res.status(201).json({
        id: newFile._id,
        userId: content.owner,
        name: content.name,
        type: content.type,
        isPublic: content.isPublic,
        parentId: content.parentId,
      });
    } catch (error) {
      console.error('Error in postUpload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
