import pkg from 'mongodb';

const { MongoClient } = pkg;

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
      const db = this.client.db(this.databaseName);
      const collection = db.collection('users');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      return null;
    }
  }

  async nbFiles() {
    try {
      const db = this.client.db(this.databaseName);
      const collection = db.collection('files');
      const count = await collection.countDocuments();
      return count;
    } catch (error) {
      return null;
    }
  }
}

const dbClient = new DBClient();
export default dbClient;
