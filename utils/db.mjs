import pkg from 'mongodb';

const { MongoClient } = pkg;
const { ObjectId } = pkg;

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    this.uri = `mongodb://${host}:${port}`;
    this.databaseName = database;
    this.client = new MongoClient(this.uri, { useUnifiedTopology: true });

    this.client.connect().catch(() => {});
  }

  isAlive() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  async nbUsers() {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = await db.collection('users');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      console.error('Error in nbUsers:', error);
      return null;
    }
  }

  async nbFiles() {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = await db.collection('files');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      console.error('Error in nbUsers:', error);
      return null;
    }
  }

  async findUserByEmail(email) {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = await db.collection('users');
      return await collection.findOne({ email });
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      return null;
    }
  }

  async findUserById(userId) {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = await db.collection('users');
      const _id = new ObjectId(userId);
      return await collection.findOne({ _id });
    } catch (error) {
      console.error('Error in findUserById:', error);
      return null;
    }
  }

  async createUser(email, hashedPassword) {
    try {
      await this.client.connect();
      const db = this.client.db(this.databaseName);
      const collection = db.collection('users');
      const result = await collection.insertOne({ email, password: hashedPassword });
      return result.ops[0];
    } catch (error) {
      console.error('Error in createUser:', error);
      return null;
    }
  }
}

const dbClient = new DBClient();
export default dbClient;
