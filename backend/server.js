require('dotenv').config();

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Request failed:', err.message);
  res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`ParkEase server listening on port ${port}`);
});
