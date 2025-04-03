const AppController = require('../controllers/AppController.js');

module.exports=function(app) {
  app.get('/', function(req, res) {
    res.send('/ called successfully');
  });

  app.get('/status', function(req, res) {
    AppController.getStatus(req, res);
  });

  app.get('/stats', function(req, res) {
    AppController.getStats(req, res);
  })
}
