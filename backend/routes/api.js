const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const supabase = require('../config/supabase');
const { validatePeriod, cleanText } = require('../utils/validation');

const router = express.Router();

function databaseError(res, error, action) {
  console.error(`Database ${action} failed:`, error.message);
  return res.status(500).json({ success: false, error: `Could not ${action}.` });
}

// GET /api/spots?date=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM
router.get('/spots', async (req, res) => {
  const { date, startTime, endTime } = req.query;
  const validationError = validatePeriod(date, startTime, endTime);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  const { data: spots, error: spotsError } = await supabase
    .from('parking_spots')
    .select('id, level, type, label, price_per_hour, is_active')
    .eq('is_active', true)
    .order('id');
  if (spotsError) return databaseError(res, spotsError, 'load parking spots');

  const { data: bookings, error: bookingsError } = await supabase
    .from('parking_bookings')
    .select('spot_id')
    .eq('booking_date', date)
    .eq('status', 'active')
    .lt('start_time', endTime)
    .gt('end_time', startTime);
  if (bookingsError) return databaseError(res, bookingsError, 'check availability');

  const busyIds = new Set(bookings.map(booking => booking.spot_id));
  const result = spots.map(spot => ({
    id: spot.id,
    level: spot.level,
    type: spot.type,
    label: spot.label,
    pricePerHour: Number(spot.price_per_hour),
    available: !busyIds.has(spot.id)
  }));

  return res.json({ success: true, data: result });
});

// POST /api/bookings — returns the cancellation token once; save it for the user.
router.post('/bookings', async (req, res) => {
  const spotId = cleanText(req.body.spotId, 30);
  const driverName = cleanText(req.body.driverName, 60);
  const vehicleNumber = cleanText(req.body.vehicleNumber, 15).toUpperCase();
  const { date, startTime, endTime } = req.body;
  const validationError = validatePeriod(date, startTime, endTime);

  if (validationError) return res.status(400).json({ success: false, error: validationError });
  if (!spotId || !driverName || !vehicleNumber) {
    return res.status(400).json({ success: false, error: 'Spot, name, and vehicle registration are required.' });
  }

  const token = randomBytes(32).toString('hex');
  const cancelTokenHash = createHash('sha256').update(token).digest('hex');
  const { data, error } = await supabase
    .from('parking_bookings')
    .insert({
      spot_id: spotId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      driver_name: driverName,
      vehicle_number: vehicleNumber,
      cancel_token_hash: cancelTokenHash
    })
    .select('id, spot_id, booking_date, start_time, end_time, driver_name, vehicle_number, status, created_at')
    .single();

  if (error) {
    // The database exclusion constraint safely rejects overlapping active reservations.
    if (error.code === '23P01' || error.code === '23505') {
      return res.status(409).json({ success: false, error: 'That parking spot is no longer available for the selected time.' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ success: false, error: 'The selected parking spot does not exist.' });
    }
    return databaseError(res, error, 'create reservation');
  }

  return res.status(201).json({
    success: true,
    data: {
      booking: data,
      cancelToken: token
    }
  });
});

// DELETE /api/bookings/:id — provide the one-time cancellation token in JSON.
router.delete('/bookings/:id', async (req, res) => {
  const token = typeof req.body.cancelToken === 'string' ? req.body.cancelToken : '';
  if (!token || token.length > 200) {
    return res.status(400).json({ success: false, error: 'A valid cancellation token is required.' });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data, error } = await supabase
    .from('parking_bookings')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('cancel_token_hash', tokenHash)
    .eq('status', 'active')
    .select('id, spot_id, booking_date, start_time, end_time, status')
    .maybeSingle();

  if (error) return databaseError(res, error, 'cancel reservation');
  if (!data) return res.status(404).json({ success: false, error: 'Reservation was not found, is already cancelled, or the token is incorrect.' });
  return res.json({ success: true, data });
});

module.exports = router;
