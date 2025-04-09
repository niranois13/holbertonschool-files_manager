import mime from 'mime-types';
import fs from 'fs';
import pkg from 'mongodb';

const { MongoClient, ObjectId } = pkg;

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    this.uri = `mongodb://${host}:${port}`;
    this.databaseName = database;
    this.client = new MongoClient(this.uri, { useUnifiedTopology: true });
    this.connected = this.client.connect().catch(() => {});
  }

  isAlive() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  static pagination(matchEngine, skipEngine = 0, limitEngine = 20, sortEngine = { _id: 1 }) {
    const pipeline = [
      {
        $match: matchEngine,
      },
      {
        $sort: sortEngine,
      },
      {
        $skip: skipEngine,
      },
      {
        $limit: limitEngine,
      },
    ];
    return pipeline;
  }

  async _getCollection(collectionName) {
    await this.connected;
    return this.client.db(this.databaseName).collection(collectionName);
  }

  async nbUsers() {
    try {
      const users = await this._getCollection('users');
      return await users.countDocuments();
    } catch (error) {
      console.error('Error in nbUsers:', error);
      return null;
    }
  }

  async nbFiles() {
    try {
      const files = await this._getCollection('files');
      return await files.countDocuments();
    } catch (error) {
      console.error('Error in nbUsers:', error);
      return null;
    }
  }

  async findUserByEmail(email) {
    try {
      const users = await this._getCollection('users');
      return await users.findOne({ email });
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      return null;
    }
  }

  async findUserById(userId) {
    try {
      const users = await this._getCollection('users');
      const _id = new ObjectId(userId);
      return await users.findOne({ _id });
    } catch (error) {
      console.error('Error in findUserById:', error);
      return null;
    }
  }

  async createUser(email, hashedPassword) {
    try {
      const users = await this._getCollection('users');
      const result = await users.insertOne({ email, password: hashedPassword });
      return { id: result.insertedId, email };
    } catch (error) {
      console.error('Error in createUser:', error);
      return null;
    }
  }

  async createFile(fileData) {
    try {
      const files = await this._getCollection('files');
      const result = await files.insertOne(fileData);
      return {
        _id: result.insertedId,
        userId: fileData.userId,
        name: fileData.name,
        type: fileData.type,
        isPublic: fileData.isPublic,
        parentId: fileData.parentId,
      };
    } catch (error) {
      console.error('Error in createFile:', error);
      return null;
    }
  }

  async createFolder(folderData) {
    try {
      const files = await this._getCollection('files');
      const result = await files.insertOne(folderData);
      return {
        _id: result.insertedId,
        userId: folderData.userId,
        name: folderData.name,
        type: folderData.type,
        parentId: folderData.parentId,
      };
    } catch (error) {
      console.error('Error in createFolder:', error);
      return null;
    }
  }

  async findFileById(fileId) {
    try {
      const files = await this._getCollection('files');
      const _id = new ObjectId(fileId);
      return await files.findOne({ _id });
    } catch (error) {
      console.error('Error in findFileById:', error);
      return null;
    }
  }

  async findDataById(fileId, reqUserId) {
    try {
      const file = await this.findFileById(fileId);
      if (!file) {
        return ('No file found');
      }
      if (!file.isPublic) {
        if (!reqUserId) {
          return ('No file found');
        }
        const userId = new ObjectId(reqUserId);
        if (!userId.equals(file.userId)) {
          return ('No file found');
        } else {
          if (file.type === 'folder') {
            return ('Folder found');
          }
        }
      }
      if (file.isPublic && file.type === 'folder') {
        return ('Folder found');
      }
      if (!file.localPath) {
        return ('No file found');
      }

      const filePath = file.localPath;
      if (!fs.existsSync(filePath)) {
        return ('Not found');
      }
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      const fileData = fs.readFileSync(filePath);

      const fileContent = {
        data: fileData,
        mime: mimeType,
      };

      return (fileContent);
    } catch (error) {
      console.error('Error in findDataById:', error);
      return null;
    }
  }

  async findFilesByUserId(reqUserId, page) {
    try {
      const files = await this._getCollection('files');
      const userId = new ObjectId(reqUserId);
      const pageSize = 20;
      const skipEngine = page * pageSize;
      const limitEngine = pageSize;
      const matchEngine = { userId };

      const pipeline = DBClient.pagination(matchEngine, skipEngine, limitEngine);

      return await files.aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error in findFileByUserId:', error);
      return null;
    }
  }

  async findFileByUserAndId(fileId, reqUserId) {
    try {
      const files = await this._getCollection('files');
      const _id = new ObjectId(fileId);
      const userId = new ObjectId(reqUserId);
      return await files.findOne({ _id, userId });
    } catch (error) {
      console.error('Error in findFileByUserAndId:', error);
      return null;
    }
  }

  async findFilesByParentId(reqParentId, reqUserId, page) {
    try {
      const files = await this._getCollection('files');
      const userId = new ObjectId(reqUserId);
      const parentId = new ObjectId(reqParentId);
      console.log(userId);
      const pageSize = 20;
      const matchEngine = { parentId };
      const skipEngine = page * pageSize;
      const limitEngine = pageSize;
      const pipeline = DBClient.pagination(matchEngine, skipEngine, limitEngine);

      return await files.aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error in findFileByParentId:', error);
      return null;
    }
  }

  async publishFile(reqFileId, reqUserId) {
    try {
      console.log('[publishFile] Start - reqFileId:', reqFileId, 'reqUserId:', reqUserId);

      const files = await this._getCollection('files');
      console.log('[publishFile] Retrieved files collection');

      const userId = new ObjectId(reqUserId);
      const _id = new ObjectId(reqFileId);
      const filter = { userId, _id };

      console.log('[publishFile] Filter for query:', filter);

      const file = await files.findOne(filter);
      console.log('[publishFile] File found:', file);

      if (!file) {
        console.log('[publishFile] File not found or is a folder');
        return null;
      }

      const updateFile = {
        $set: {
          isPublic: true,
        },
      };

      await files.updateOne(filter, updateFile);

      const updatedFile = await files.findOne(filter);
      console.log('[publishFile] Updated file:', updatedFile);

      return updatedFile;
    } catch (error) {
      console.error('[publishFile] Error in publishFile:', error);
      return null;
    }
  }

  async unpublishFile(reqFileId, reqUserId) {
    try {
      const files = await this._getCollection('files');
      const userId = new ObjectId(reqUserId);
      const _id = new ObjectId(reqFileId);
      const filter = { userId, _id };

      const file = await files.findOne(filter);
      if (!file) {
        return null;
      }

      const updateFile = {
        $set: {
          isPublic: false,
        },
      };

      await files.updateOne(filter, updateFile);

      return await files.findOne(filter);
    } catch (error) {
      console.error('Error in updateIsPublic:', error);
      return null;
    }
  }
}

const dbClient = new DBClient();
export default dbClient;
