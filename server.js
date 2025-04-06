const express = require('express');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

if (routes) {
  routes(app);
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
