const authenticateJWT = (req, res, next) => {
  req.user = { id: 'mock-user-id', isAdmin: true };
  next();
};

const authenticateApiKey = (req, res, next) => {
  req.apiKey = { UserId: 'mock-user-id', permissions: ['all'] };
  req.user = { id: 'mock-user-id', isAdmin: true };
  next();
};

const requireAdmin = (req, res, next) => {
  next();
};

const requireApiPermission = (permission) => (req, res, next) => {
  next();
};

module.exports = {
  authenticateJWT,
  authenticateApiKey,
  requireAdmin,
  requireApiPermission,
};
