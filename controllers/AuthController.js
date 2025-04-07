const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const dbClient = require('../utils/db').default;
const redisClient = require('../utils/redis').default;

module.exports = {
  async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.replace('Basic ', '');
    const utfCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');

    const [email, password] = utfCredentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userExist = await dbClient.findUserByEmail(email);
    if (!userExist) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (userExist.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const uuidToken = uuidv4();
    const tokenKey = (`auth_${uuidToken}`);
    await redisClient.set(tokenKey, userExist._id.toString(), 86400);

    return res.status(200).json({ token: uuidToken });
  },

  async xTokenHandler(req) {
    const token = req.headers['x-token'];
    if (!token) {
      return null;
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }

    return userId;
  },

  async getDisconnect(req, res) {
    const userLogout = await this.xTokenHandler(req, res);
    if (!userLogout) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = req.headers['x-token'];
    await redisClient.del(`auth_${token}`);

    return res.status(204).send();
  },
};
