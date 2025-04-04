const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController')

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

  app.get('/connect', (req, res) => {
    AuthController.getConnect(req, res);
  })

  app.get('/disconnect', (req, res) => {
    AuthController.getDisconnect(req, res);
  })

  app.get('/users/me', (req, res) => {
    UsersController.getMe(req, res);
  })

  app.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });
};
