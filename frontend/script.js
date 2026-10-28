const demoSpots = [
  { id: 'A-01', level: 'Level 1', type: 'standard', label: 'Standard', price: 2.5, available: true },
  { id: 'A-02', level: 'Level 1', type: 'electric', label: 'Electric charging', price: 3.5, available: true },
  { id: 'A-03', level: 'Level 1', type: 'standard', label: 'Standard', price: 2.5, available: false },
  { id: 'A-04', level: 'Level 1', type: 'accessible', label: 'Accessible', price: 2.5, available: true },
  { id: 'B-01', level: 'Level 2', type: 'standard', label: 'Standard', price: 2.5, available: true },
  { id: 'B-02', level: 'Level 2', type: 'electric', label: 'Electric charging', price: 3.5, available: false },
  { id: 'B-03', level: 'Level 2', type: 'standard', label: 'Standard', price: 2.5, available: true },
  { id: 'B-04', level: 'Level 2', type: 'accessible', label: 'Accessible', price: 2.5, available: true }
];

const storageKey = 'parkease-demo-bookings';
const dateInput = document.getElementById('booking-date');
const startInput = document.getElementById('start-time');
const endInput = document.getElementById('end-time');
const spotGrid = document.getElementById('spot-grid');
const filterSelect = document.getElementById('spot-filter');
const dialog = document.getElementById('booking-dialog');
const bookingForm = document.getElementById('booking-form');
let selectedSpot = null;
let toastTimer;

function getBookings() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveBookings(bookings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(bookings));
    return true;
  } catch {
    showToast('Could not save in this browser. Check your storage settings.');
    return false;
  }
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  return new Date(`${dateValue}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function formatTime(timeValue) {
  const [hour, minute] = timeValue.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function selectedDuration() {
  const [startHour, startMinute] = startInput.value.split(':').map(Number);
  const [endHour, endMinute] = endInput.value.split(':').map(Number);
  return (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
}

function updatePeriodText() {
  const date = dateInput.value ? formatDate(dateInput.value) : 'Choose a date';
  const times = startInput.value && endInput.value
    ? `${formatTime(startInput.value)} – ${formatTime(endInput.value)}`
    : 'Choose a time period';
  document.getElementById('selected-period').textContent = `${date} · ${times}`;
}

function hasBookingFor(spotId) {
  return getBookings().some(booking => booking.spotId === spotId && booking.date === dateInput.value);
}

function renderSpots() {
  const filter = filterSelect.value;
  const filteredSpots = demoSpots.filter(spot => filter === 'all' || spot.type === filter);
  const count = filteredSpots.filter(spot => spot.available && !hasBookingFor(spot.id)).length;
  document.getElementById('available-count').textContent = `${count} ${count === 1 ? 'spot' : 'spots'} available`;
  spotGrid.replaceChildren();
  document.getElementById('empty-state').hidden = filteredSpots.length !== 0;

  filteredSpots.forEach(spot => {
    const bookedHere = hasBookingFor(spot.id);
    const available = spot.available && !bookedHere;
    const card = document.createElement('article');
    card.className = `spot-card${available ? '' : ' unavailable'}`;
    const icon = spot.type === 'electric' ? 'ϟ' : spot.type === 'accessible' ? '♿' : '↗';

    const top = document.createElement('div');
    top.className = 'spot-top';
    const info = document.createElement('div');
    const id = document.createElement('div');
    id.className = 'spot-id';
    id.textContent = spot.id;
    const type = document.createElement('div');
    type.className = 'spot-type';
    type.textContent = spot.label;
    info.append(id, type);
    const iconBox = document.createElement('span');
    iconBox.className = 'spot-icon';
    iconBox.setAttribute('aria-hidden', 'true');
    iconBox.textContent = icon;
    top.append(info, iconBox);

    const meta = document.createElement('div');
    meta.className = 'spot-meta';
    const level = document.createElement('span');
    level.textContent = spot.level;
    const state = document.createElement('span');
    state.textContent = available ? 'Available' : bookedHere ? 'Your reservation' : 'Unavailable';
    meta.append(level, state);

    const bottom = document.createElement('div');
    bottom.className = 'spot-bottom';
    const price = document.createElement('span');
    price.className = 'spot-price';
    price.textContent = `$${spot.price.toFixed(2)} `;
    const perHour = document.createElement('small');
    perHour.textContent = '/ hour';
    price.append(perHour);
    const action = document.createElement('button');
    action.className = 'spot-action';
    action.type = 'button';
    action.disabled = !available;
    action.textContent = available ? 'Reserve →' : 'Not available';
    action.setAttribute('aria-label', available ? `Reserve parking spot ${spot.id}` : `Spot ${spot.id} is unavailable`);
    if (available) action.addEventListener('click', () => openBooking(spot));
    bottom.append(price, action);
    card.append(top, meta, bottom);
    spotGrid.append(card);
  });
}

function renderBookings() {
  const bookings = getBookings();
  const list = document.getElementById('bookings-list');
  list.replaceChildren();
  document.getElementById('bookings-empty').hidden = bookings.length > 0;
  document.getElementById('booking-count').textContent = String(bookings.length);

  bookings.forEach(booking => {
    const row = document.createElement('article');
    row.className = 'booking-row';
    const info = document.createElement('div');
    info.className = 'booking-info';
    const icon = document.createElement('span');
    icon.className = 'booking-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'P';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Spot ${booking.spotId} · Riverside Campus`;
    const time = document.createElement('small');
    time.textContent = `${formatDate(booking.date)} · ${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;
    details.append(title, time);
    info.append(icon, details);
    const vehicle = document.createElement('span');
    vehicle.className = 'booking-vehicle';
    vehicle.textContent = booking.vehicleNumber;
    const cancel = document.createElement('button');
    cancel.className = 'cancel-button';
    cancel.type = 'button';
    cancel.textContent = 'Cancel booking';
    cancel.addEventListener('click', () => cancelBooking(booking.id));
    row.append(info, vehicle, cancel);
    list.append(row);
  });
}

function openBooking(spot) {
  selectedSpot = spot;
  document.getElementById('dialog-spot-detail').textContent = `${spot.id} · ${spot.level} · ${formatDate(dateInput.value)} · ${formatTime(startInput.value)} – ${formatTime(endInput.value)} · $${spot.price.toFixed(2)}/hour`;
  document.getElementById('dialog-error').textContent = '';
  bookingForm.reset();
  dialog.showModal();
  document.getElementById('driver-name').focus();
}

function cancelBooking(bookingId) {
  if (!window.confirm('Cancel this parking reservation?')) return;
  const remaining = getBookings().filter(booking => booking.id !== bookingId);
  if (saveBookings(remaining)) {
    renderBookings();
    renderSpots();
    showToast('Your reservation has been cancelled.');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

document.getElementById('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const message = document.getElementById('search-message');
  message.textContent = '';
  if (selectedDuration() <= 0) {
    message.textContent = 'Leave-by time must be later than arrival time.';
    return;
  }
  updatePeriodText();
  renderSpots();
  showToast('Availability updated for your selected time.');
});

[dateInput, startInput, endInput].forEach(input => {
  input.addEventListener('change', () => {
    document.getElementById('search-message').textContent = '';
    updatePeriodText();
  });
});
filterSelect.addEventListener('change', renderSpots);
document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});

bookingForm.addEventListener('submit', event => {
  event.preventDefault();
  const driverName = document.getElementById('driver-name').value.trim();
  const vehicleNumber = document.getElementById('vehicle-number').value.trim().toUpperCase();
  const error = document.getElementById('dialog-error');
  if (!selectedSpot || !driverName || !vehicleNumber) {
    error.textContent = 'Please enter your name and vehicle registration.';
    return;
  }
  if (selectedDuration() <= 0) {
    error.textContent = 'The selected time period is not valid.';
    return;
  }
  if (hasBookingFor(selectedSpot.id)) {
    error.textContent = 'This spot is already reserved in this demo. Choose another spot.';
    return;
  }

  const booking = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    spotId: selectedSpot.id,
    date: dateInput.value,
    startTime: startInput.value,
    endTime: endInput.value,
    driverName,
    vehicleNumber
  };
  const bookings = getBookings();
  bookings.push(booking);
  if (saveBookings(bookings)) {
    dialog.close();
    renderBookings();
    renderSpots();
    showToast(`Spot ${selectedSpot.id} reserved successfully.`);
  }
});

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.min = localToday;
dateInput.value = localToday;
updatePeriodText();
renderSpots();
renderBookings();
