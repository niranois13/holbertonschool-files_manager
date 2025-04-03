const redisUtil = require('../utils/redis.mjs').default;
const dbUtil = require('../utils/db.mjs').default;

module.exports = {
  getStatus(req, res) {
    if (redisUtil.isAlive()) {
      if (dbUtil.isAlive()) {
        res.status(200).json({ "redis": true, "db": true})
      } else {
        res.status(200).json({ "redis": true, "db": false})
      }
    } else {
      if (dbUtil.isAlive()) {
        res.status(200).json({ "redis": false, "db": true})
      }
      res.status(500).json({ "redis": false, "db": false})
    }
  },

  async getStats(req, res) {
    try {
      let dbUsers = await dbUtil.nbUsers(req);
      let dbFiles = await dbUtil.nbFiles(req);

      console.log("Users:", dbUsers);
      console.log("Files:", dbFiles);

      if (dbUsers !== null && dbFiles !== null) {
        res.status(200).json({ "users": dbUsers, "files": dbFiles});
      } else {
        res.status(500).json({ "Error": "DB returned null values"});
      }
    } catch (error) {
      console.error("Error in getStats:", error);
      res.status(500).json({ "Error": "Server error"} );
    }
  }
}
