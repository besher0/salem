const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.get('Authorization') || req.get('authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

    const secret = process.env.JWT_SECRET || process.env.SECRET || 'thisismysecretkey';

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!decodedToken) {
      return res.status(401).json({ message: 'Not authenticated!' });
    }

    req.userId = decodedToken.userId;
    next();
  } catch (error) {
    next(error);
  }
};
