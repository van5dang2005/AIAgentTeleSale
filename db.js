// db.js - Quan ly database SQLite cho khach hang, lich hen, va hoi thoai
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dental_bot.db'));
db.pragma('journal_mode = WAL');

// ----- KHOI TAO BANG -----
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  note TEXT,
  source TEXT DEFAULT 'web_chat',
  status TEXT DEFAULT 'moi',        -- moi | dang_tu_van | da_dat_lich | huy
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  service TEXT,                     -- dich vu: tay trang, nieng rang, nho rang...
  appointment_date TEXT,            -- YYYY-MM-DD
  appointment_time TEXT,            -- HH:MM
  status TEXT DEFAULT 'cho_xac_nhan', -- cho_xac_nhan | da_xac_nhan | da_huy | hoan_thanh
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  role TEXT,                        -- user | model
  message TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
`);

// ----- CUSTOMERS -----
function upsertCustomer({ id, name, phone, note }) {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`
      UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        note = COALESCE(?, note),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name || null, phone || null, note || null, id);
  } else {
    db.prepare(`
      INSERT INTO customers (id, name, phone, note)
      VALUES (?, ?, ?, ?)
    `).run(id, name || null, phone || null, note || null);
  }
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function getCustomer(id) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function setCustomerStatus(id, status) {
  db.prepare(`UPDATE customers SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(status, id);
}

function listCustomers() {
  return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
}

// ----- APPOINTMENTS -----
function createAppointment({ id, customer_id, service, appointment_date, appointment_time }) {
  db.prepare(`
    INSERT INTO appointments (id, customer_id, service, appointment_date, appointment_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, customer_id, service, appointment_date, appointment_time);
  setCustomerStatus(customer_id, 'da_dat_lich');
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

function listAppointments() {
  return db.prepare(`
    SELECT a.*, c.name as customer_name, c.phone as customer_phone
    FROM appointments a
    JOIN customers c ON a.customer_id = c.id
    ORDER BY a.appointment_date, a.appointment_time
  `).all();
}

function getAppointmentsByCustomer(customer_id) {
  return db.prepare('SELECT * FROM appointments WHERE customer_id = ? ORDER BY appointment_date').all(customer_id);
}

function cancelAppointment(id) {
  db.prepare(`UPDATE appointments SET status = 'da_huy' WHERE id = ?`).run(id);
}

// ----- CONVERSATIONS -----
function saveMessage({ id, customer_id, role, message }) {
  db.prepare(`
    INSERT INTO conversations (id, customer_id, role, message)
    VALUES (?, ?, ?, ?)
  `).run(id, customer_id, role, message);
}

function getHistory(customer_id, limit = 20) {
  const rows = db.prepare(`
    SELECT role, message FROM conversations
    WHERE customer_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(customer_id, limit);
  return rows;
}

module.exports = {
  db,
  upsertCustomer,
  getCustomer,
  setCustomerStatus,
  listCustomers,
  createAppointment,
  listAppointments,
  getAppointmentsByCustomer,
  cancelAppointment,
  saveMessage,
  getHistory,
};
