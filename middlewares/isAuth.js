const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    let token = req.get('Authorization');
    if (!token) {
      return res.status(422).json({ message: `jwt must be provided` });
    }
    token = token.split(' ')[1];
    let decodedToken;
    decodedToken = jwt.verify(token, 'thisismysecretkey');
    if (!decodedToken) {
      return res.status(401).json({ message: 'Not authenticated!' });
    }
    req.userId = decodedToken.userId;
    next();
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};
