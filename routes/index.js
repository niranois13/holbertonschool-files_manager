const AppController = require('../controllers/AppController');

module.exports = (app) => {
  app.get('/', (req, res) => {
    res.send('/ called successfully');
  });

  app.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  app.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });
};
