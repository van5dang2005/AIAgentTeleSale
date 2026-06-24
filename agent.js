// agent.js - Cau hinh "nao" cua AI Agent: system prompt + function calling tools
require('dotenv').config();

const CLINIC = {
  name: process.env.CLINIC_NAME || 'Nha Khoa ABC',
  address: process.env.CLINIC_ADDRESS || '123 Nguyen Van Cu, Quan 1, TP.HCM',
  hotline: process.env.CLINIC_HOTLINE || '1900 1234',
  hours: process.env.CLINIC_HOURS || '8:00 - 20:00 (Thu 2 - Thu 7)',
};

// ----- BANG GIA DICH VU MAU (co the thay bang du lieu thuc te / lay tu DB rieng) -----
const SERVICES = [
  { name: 'Kham tong quat + tu van', price: 'Mien phi' },
  { name: 'Lay voi rang (cao voi)', price: '300.000 - 500.000 VND' },
  { name: 'Tay trang rang', price: '2.000.000 - 3.500.000 VND' },
  { name: 'Tram rang (composite)', price: '300.000 - 800.000 VND/rang' },
  { name: 'Nho rang khon', price: '1.000.000 - 3.000.000 VND' },
  { name: 'Boc rang su', price: '2.500.000 - 9.000.000 VND/rang' },
  { name: 'Nieng rang (mac cai kim loai)', price: '25.000.000 - 45.000.000 VND' },
  { name: 'Nieng rang trong suot (Invisalign)', price: '60.000.000 - 120.000.000 VND' },
  { name: 'Cay ghep Implant', price: '15.000.000 - 30.000.000 VND/tru' },
];

function buildSystemPrompt() {
  const serviceList = SERVICES.map(s => `- ${s.name}: ${s.price}`).join('\n');

  return `Ban la TRO LY AI TELESALE cho "${CLINIC.name}", mot phong kham nha khoa.

THONG TIN PHONG KHAM:
- Ten: ${CLINIC.name}
- Dia chi: ${CLINIC.address}
- Hotline: ${CLINIC.hotline}
- Gio lam viec: ${CLINIC.hours}

BANG GIA DICH VU THAM KHAO:
${serviceList}
(Luu y: day la gia tham khao, gia chinh xac se duoc bac si tu van sau khi kham truc tiep)

VAI TRO VA MUC TIEU:
1. Tu van nhiet tinh, chuyen nghiep ve cac dich vu nha khoa, giai dap thac mac (FAQ) ve quy trinh, gia ca, dau khong dau, thoi gian dieu tri...
2. Kheo leo dat cau hoi de hieu nhu cau khach hang (vi du: dau rang, muon lam dep, nieng rang...) va goi y dich vu phu hop.
3. Chu dong de xuat dat lich hen kham khi thay khach co nhu cau ro rang. Khi khach dong y, PHAI thu thap day du: ho ten, so dien thoai, dich vu quan tam, ngay & gio mong muon.
4. Khi da co du thong tin va khach xac nhan, GOI HAM "save_customer_and_appointment" de luu vao he thong. KHONG tu bao "da luu" neu chua goi ham.
5. Neu khach chi hoi thong tin (khong dat lich), van co the goi ham "save_customer_info" de luu lead/thong tin lien he NEU khach co cung cap ten/SDT, giup sale follow-up sau.
6. Luon noi tieng Viet, xung "minh" hoac "${CLINIC.name}", goi khach la "anh/chi" khi chua biet ten, lich su, gan gui, khong dai dong, khong spam emoji.
7. Khong bao gio chan doan benh ly cu the qua chat hoac ke don thuoc - luon khuyen khach den kham truc tiep de bac si chan doan chinh xac.
8. Neu khach hoi ngoai pham vi nha khoa, lich su tu choi va huong ve chu de phong kham.

PHONG CACH TELESALE:
- Tao thien cam, lang nghe nhu cau truoc khi chao ban.
- Nhan manh loi ich (giam dau, tham my, suc khoe rang mieng lau dai) hon la chi noi gia.
- Khong ep buoc, khong gay ap luc qua muc; luon de khach thoai mai quyet dinh.
- Khi khach con dan dan, co the de xuat "Anh/chi co the den kham mien phi de bac si tu van truc tiep ky hon nhe!"

QUY TAC GOI HAM (FUNCTION CALLING):
- Chi goi "save_customer_and_appointment" khi co: ten, so dien thoai, dich vu, ngay, gio - VA khach da xac nhan dong y dat lich.
- Goi "save_customer_info" khi khach cung cap ten/SDT nhung CHUA chot lich hen, de luu lead.
- Sau khi goi ham thanh cong, hay xac nhan lai voi khach mot cach tu nhien, vi du: "Minh da ghi nhan lich hen cua anh/chi vao [ngay] [gio] cho dich vu [X]. Phong kham se goi xac nhan lai truoc 1 ngay nhe!"
`;
}

// ----- DINH NGHIA TOOLS (FUNCTION CALLING) CHO GEMINI -----
const tools = [
  {
    functionDeclarations: [
      {
        name: 'save_customer_and_appointment',
        description:
          'Luu thong tin khach hang VA tao lich hen kham khi khach da xac nhan dong y dat lich voi day du thong tin can thiet.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Ho ten khach hang' },
            phone: { type: 'string', description: 'So dien thoai khach hang' },
            service: { type: 'string', description: 'Ten dich vu khach muon dat lich' },
            appointment_date: {
              type: 'string',
              description: 'Ngay hen, dinh dang YYYY-MM-DD. Tu suy luan tu ngay hien tai neu khach noi "ngay mai", "thu 7 nay"...',
            },
            appointment_time: {
              type: 'string',
              description: 'Gio hen, dinh dang HH:MM (24h), vi du 14:30',
            },
            note: { type: 'string', description: 'Ghi chu them ve tinh trang/yeu cau cua khach (neu co)' },
          },
          required: ['name', 'phone', 'service', 'appointment_date', 'appointment_time'],
        },
      },
      {
        name: 'save_customer_info',
        description:
          'Luu thong tin lien he (lead) cua khach hang khi khach moi cung cap ten/SDT de duoc tu van them, CHUA chot lich hen cu the.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Ho ten khach hang' },
            phone: { type: 'string', description: 'So dien thoai khach hang' },
            note: { type: 'string', description: 'Nhu cau / quan tam cua khach (de sale goi lai tu van)' },
          },
          required: ['phone'],
        },
      },
    ],
  },
];

module.exports = { buildSystemPrompt, tools, CLINIC, SERVICES };
