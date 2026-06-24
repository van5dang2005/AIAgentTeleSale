// server.js - Server chinh: nhan chat tu nguoi dung, goi Gemini, xu ly function calling
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = require('./db');
const { buildSystemPrompt, tools } = require('./agent');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.warn(
    '\n[CANH BAO] Chua cau hinh GEMINI_API_KEY trong file .env\n' +
    'Lay API key tai: https://aistudio.google.com/app/apikey\n'
  );
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'missing-key');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ----- THUC THI HAM (FUNCTION CALLING) DUOC GEMINI GOI -----
function executeFunctionCall(call, customerId) {
  const { name, args } = call;

  if (name === 'save_customer_and_appointment') {
    const customer = db.upsertCustomer({
      id: customerId,
      name: args.name,
      phone: args.phone,
      note: args.note || null,
    });
    const appointment = db.createAppointment({
      id: uuidv4(),
      customer_id: customerId,
      service: args.service,
      appointment_date: args.appointment_date,
      appointment_time: args.appointment_time,
    });
    return {
      success: true,
      message: `Da luu lich hen cho ${customer.name} - dich vu ${appointment.service} vao ${appointment.appointment_date} ${appointment.appointment_time}`,
      customer,
      appointment,
    };
  }

  if (name === 'save_customer_info') {
    const customer = db.upsertCustomer({
      id: customerId,
      name: args.name || null,
      phone: args.phone,
      note: args.note || null,
    });
    db.setCustomerStatus(customerId, 'dang_tu_van');
    return {
      success: true,
      message: `Da luu thong tin lien he cua khach hang ${customer.name || ''} (${customer.phone})`,
      customer,
    };
  }

  return { success: false, message: `Khong tim thay ham: ${name}` };
}

// ----- API CHAT CHINH -----
app.post('/api/chat', async (req, res) => {
  try {
    const { message, customerId: rawCustomerId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Thieu noi dung tin nhan (message)' });
    }

    const customerId = rawCustomerId || uuidv4();

    // Dam bao khach hang ton tai trong DB (de luu lich su hoi thoai)
    db.upsertCustomer({ id: customerId, name: null, phone: null, note: null });

    // Luu tin nhan cua nguoi dung
    db.saveMessage({ id: uuidv4(), customer_id: customerId, role: 'user', message });

    // Lay lich su hoi thoai gan day de Gemini co context
    const history = db.getHistory(customerId, 30).map((row) => ({
      role: row.role === 'model' ? 'model' : 'user',
      parts: [{ text: row.message }],
    }));
    // Bo tin nhan cuoi (vi do chinh la "message" hien tai, se gui rieng)
    history.pop();

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: buildSystemPrompt(),
      tools,
    });

    const chat = model.startChat({ history });

    let result = await chat.sendMessage(message);
    let response = result.response;

    // Xu ly vong lap function calling (Gemini co the goi nhieu ham lien tiep)
    let functionResultsLog = [];
    let safetyCounter = 0;
    while (true) {
      const calls = response.functionCalls ? response.functionCalls() : null;
      if (!calls || calls.length === 0) break;
      if (safetyCounter++ > 5) break; // tranh lap vo han

      const functionResponses = [];
      for (const call of calls) {
        const execResult = executeFunctionCall(call, customerId);
        functionResultsLog.push({ name: call.name, args: call.args, result: execResult });
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: execResult,
          },
        });
      }

      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    const replyText = response.text();

    // Luu tin nhan tra loi cua bot
    db.saveMessage({ id: uuidv4(), customer_id: customerId, role: 'model', message: replyText });

    res.json({
      customerId,
      reply: replyText,
      actions: functionResultsLog, // de debug / hien thi cho admin neu can
    });
  } catch (err) {
    console.error('Loi /api/chat:', err);
    res.status(500).json({ error: 'Da xay ra loi khi xu ly tin nhan. Vui long thu lai.' });
  }
});

// ----- API QUAN TRI (XEM DANH SACH) -----
app.get('/api/admin/customers', (req, res) => {
  res.json(db.listCustomers());
});

app.get('/api/admin/appointments', (req, res) => {
  res.json(db.listAppointments());
});

app.get('/api/admin/customer/:id/history', (req, res) => {
  res.json(db.getHistory(req.params.id, 100));
});

app.listen(PORT, () => {
  console.log(`\n🦷  Dental Telesale Bot dang chay tai http://localhost:${PORT}`);
  console.log(`📋  Admin - Khach hang:    http://localhost:${PORT}/api/admin/customers`);
  console.log(`📅  Admin - Lich hen:      http://localhost:${PORT}/api/admin/appointments\n`);
});
