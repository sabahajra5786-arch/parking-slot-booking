const express = require('express');
const supabase = require('../config/supabase');
const requireAdmin = require('../middleware/adminAuth');
const { cleanText, isValidDate } = require('../utils/validation');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/bookings?date=YYYY-MM-DD&status=active|cancelled|all
router.get('/bookings', async (req, res) => {
  const { date, status = 'active' } = req.query;
  if (date !== undefined && !isValidDate(date)) {
    return res.status(400).json({ success: false, error: 'Date must use YYYY-MM-DD format.' });
  }
  if (!['active', 'cancelled', 'all'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be active, cancelled, or all.' });
  }

  let query = supabase
    .from('parking_bookings')
    .select('id, spot_id, booking_date, start_time, end_time, driver_name, vehicle_number, status, created_at')
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: true })
    .limit(200);
  if (date) query = query.eq('booking_date', date);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('Database list bookings failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not load reservations.' });
  }
  return res.json({ success: true, data });
});

// GET /api/admin/spots
router.get('/spots', async (req, res) => {
  const { data, error } = await supabase
    .from('parking_spots')
    .select('id, level, type, label, price_per_hour, is_active, created_at')
    .order('id');
  if (error) {
    console.error('Database list spots failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not load parking spots.' });
  }
  return res.json({ success: true, data });
});

// POST /api/admin/spots — add a slot.
router.post('/spots', async (req, res) => {
  const id = cleanText(req.body.id, 30);
  const level = cleanText(req.body.level, 40);
  const label = cleanText(req.body.label, 60);
  const type = req.body.type;
  const pricePerHour = Number(req.body.pricePerHour);

  if (!id || !level || !label || !['standard', 'accessible', 'electric'].includes(type) ||
      !Number.isFinite(pricePerHour) || pricePerHour < 0 || pricePerHour > 10000) {
    return res.status(400).json({ success: false, error: 'Provide a spot ID, level, supported type, label, and a valid non-negative hourly price.' });
  }

  const { data, error } = await supabase
    .from('parking_spots')
    .insert({ id, level, type, label, price_per_hour: pricePerHour })
    .select('id, level, type, label, price_per_hour, is_active, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'A spot with that ID already exists.' });
    console.error('Database create spot failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not create parking spot.' });
  }
  return res.status(201).json({ success: true, data });
});

// PATCH /api/admin/spots/:id — update provided fields only.
router.patch('/spots/:id', async (req, res) => {
  const update = {};
  if (req.body.level !== undefined) update.level = cleanText(req.body.level, 40);
  if (req.body.label !== undefined) update.label = cleanText(req.body.label, 60);
  if (req.body.type !== undefined) update.type = req.body.type;
  if (req.body.pricePerHour !== undefined) update.price_per_hour = Number(req.body.pricePerHour);
  if (req.body.isActive !== undefined) update.is_active = req.body.isActive;

  if (Object.keys(update).length === 0 ||
      (update.level !== undefined && !update.level) ||
      (update.label !== undefined && !update.label) ||
      (update.type !== undefined && !['standard', 'accessible', 'electric'].includes(update.type)) ||
      (update.price_per_hour !== undefined && (!Number.isFinite(update.price_per_hour) || update.price_per_hour < 0 || update.price_per_hour > 10000)) ||
      (update.is_active !== undefined && typeof update.is_active !== 'boolean')) {
    return res.status(400).json({ success: false, error: 'One or more supplied spot fields are invalid.' });
  }

  const { data, error } = await supabase
    .from('parking_spots')
    .update(update)
    .eq('id', req.params.id)
    .select('id, level, type, label, price_per_hour, is_active, created_at')
    .maybeSingle();
  if (error) {
    console.error('Database update spot failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not update parking spot.' });
  }
  if (!data) return res.status(404).json({ success: false, error: 'Parking spot not found.' });
  return res.json({ success: true, data });
});

// DELETE /api/admin/spots/:id — deactivate instead of deleting booking history.
router.delete('/spots/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('parking_spots')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select('id, is_active')
    .maybeSingle();
  if (error) {
    console.error('Database deactivate spot failed:', error.message);
    return res.status(500).json({ success: false, error: 'Could not deactivate parking spot.' });
  }
  if (!data) return res.status(404).json({ success: false, error: 'Parking spot not found.' });
  return res.json({ success: true, data, message: 'Spot deactivated; its booking history was preserved.' });
});

module.exports = router;
