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
        _id: result.insertedId.toString(),
        name: fileData.name,
        type: fileData.type,
        isPublic: fileData.isPublic,
        parentId: fileData.parentId,
        owner: fileData.owner
      };
    } catch (error) {
      console.error('Error in createFile:', error);
      return null;
    }
  }

  async findFileById(fileId) {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = db.collection('files');
      const _id = new ObjectId(fileId);
      return await collection.findOne({ _id });
    } catch (error) {
      console.error('Error in findFileById:', error);
      return null;
    }
  }
}

const dbClient = new DBClient();
export default dbClient;
