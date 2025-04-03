const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');

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

  app.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });
};
