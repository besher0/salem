require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');
const http = require('http');
const bodyParser = require('body-parser');

//routers

const adminRouter = require('./routes/Admin');
const studentRouter = require('./routes/Student');

const connectToDatabase = require('./database/connection');
app.use(express.json());
app.use(
  express.raw({ type: 'application/offset+octet-stream', limit: '50GB' })
);
// app.use(bodyParser());
app.use(cors());
app.use(helmet());
app.use(compression());
// const accessLogStream = fs.createWriteStream(
//   path.join(__dirname, 'data', 'access.log'),
//   { flags: 'a' }
// );
// app.use(morgan('tiny', { stream: accessLogStream }));
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use('/',(req,res)=>{
  res.json({message:"Welcome to the server besher"})
} );
app.use('/admin', adminRouter);
app.use('/', studentRouter);


app.use((req, res, next) => {
  // if (req.files) {
  //   const files = req.files;
  //   files.map((file) => {
  //     unlink(file.path);
  //   });
  // }
  res.status(404).json({ message: 'Page not found!' });
});

app.use((error, req, res, next) => {
  console.log('error : ');
  console.log(error);
  res.status(error?.statusCode || error[0]?.statusCode || 500).json({
    message:
      error?.message || error?.map((i) => i?.msg) || 'an error occurred!',
  });
});

connectToDatabase(process.env.MONGO_STRING)
  .then((result) => {
    app.listen(process.env.PORT || 3002);
    console.log('connected successfully.');
  })
  .catch((err) => {
    if (err) console.log('Connection to the database failed!, ');
    console.log(err);
  });

module.exports = app;
