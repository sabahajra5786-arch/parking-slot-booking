function requireAdmin(req, res, next) {
  const expectedKey = process.env.ADMIN_API_KEY;
  const suppliedKey = req.get('x-admin-key');

  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Valid admin credentials are required.' });
  }

  next();
}

module.exports = requireAdmin;
