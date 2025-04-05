const chai = require('chai');
const http = require('http');
const chaiHttp = require('chai-http');
const app = require('../server');  // Ton fichier principal avec l'app Express
const fs = require('fs');
const path = require('path');
const { expect } = chai;

chai.use(chaiHttp);

let server;

before((done) => {
  // Démarrer le serveur avant les tests
  server = http.createServer(app).listen(6000, done); // Save the server instance
});

after((done) => {
  // Fermer le serveur après les tests
  server.close(done); // Use the server instance to close it
});

describe('POST /files', function () {
  it('should create a folder at the root', async function () {
    // Préparer les données de la requête
    const folderData = {
      name: 'Test Folder',
      type: 'folder',  // Assurer que c'est bien un dossier
      parentId: '0',  // À la racine
      isPublic: false,
    };

    // Faire la requête HTTP
    const res = await chai
      .request(server) // Use the server instance for the request
      .post('/files')
      .set('x-token', 'e96999dc-f884-4047-870e-e418b718fbc5') // Ajouter un token valide
      .send(folderData);

    // Vérifier que la réponse est correcte
    expect(res).to.have.status(201);
    expect(res.body).to.have.property('id');
    expect(res.body.name).to.equal('Test Folder');
    expect(res.body.type).to.equal('folder');
    expect(res.body.parentId).to.equal('0');

    // Vérifier que le dossier a bien été créé sur le disque
    const folderPath = path.join(process.env.FOLDER_PATH || '/tmp/files_manager', res.body.id);
    const folderExists = fs.existsSync(folderPath);
    expect(folderExists).to.be.true;

    // Nettoyer après le test (supprimer le dossier créé)
    fs.rmSync(folderPath, { recursive: true, force: true });
  });
});
