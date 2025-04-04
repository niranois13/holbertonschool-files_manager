const sha1 = require('sha1');
const dbClient = require('../utils/db').default;
const { xTokenHandler } = require('./AuthController');

module.exports = {
  async postNew(req, res) {
    console.log(`Request: ${req.body}`);
    const { email } = req.body;
    const { password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const notUniqEmail = await dbClient.findUserByEmail(email);
    if (notUniqEmail) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);

    const newUser = await dbClient.createUser(email, hashedPassword);
    if (!newUser) {
      return res.status(500).json({ error: 'Error creating new user' });
    }

    return res.status(201).json({ id: newUser._id, email: newUser.email });
  },

  async getMe(req, res) {
    const userId = await xTokenHandler(req, res);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.findUserById(userId);
    console.log(user);

    return res.status(201).json({ id: user._id, email: user.email });
  },
};
