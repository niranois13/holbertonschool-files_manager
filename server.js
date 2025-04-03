const express = require('express');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

const routePath = './routes/index.js';

if (fs.existsSync(routePath)) {
  require(routePath)(app);
} else {
  console.error('routes/index.js not found');
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
