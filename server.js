const express = require('express');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

if (routes) {
  routes(app);
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
