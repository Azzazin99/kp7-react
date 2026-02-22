# ระบบยืม-คืน กพ.7 สพป.ชัยนาท

React + Vite + Express ใช้ **Google Sheets** เก็บข้อมูล

## ตั้งค่า Google Sheets

1. สร้างโปรเจกต์ใน [Google Cloud Console](https://console.cloud.google.com/) เปิดใช้ **Google Sheets API**
2. สร้าง Service Account แล้วดาวน์โหลด JSON เก็บไว้เป็น `credentials.json` ในโฟลเดอร์โปรเจกต์ (หรือใส่เนื้อหา JSON ใน env เป็น `GOOGLE_CREDENTIALS`)
3. เปิด Google Sheet ที่จะใช้ ตั้งชื่อชีทดังนี้:
   - **Master_Personnel** (หรือ Personnel): คอลัมน์ หน่วยงาน, ชื่อ-นามสกุล, ตำแหน่ง, ศูนย์ประสานงานทางการศึกษา, แฟ้มที่
   - **Transactions**: วันที่, โรงเรียน, ชื่อ, เหตุผล, สถานะ, วันที่คืน
   - **News**: วันที่, หัวข้อ, เนื้อหา, รูป (ถ้ามี)
   - **Audit_Log**: วันที่, user, action, details
4. แชร์ Sheet ให้อีเมลของ Service Account (client_email ใน JSON) เป็น **Editor**
5. Copy รหัส Spreadsheet จาก URL (`https://docs.google.com/spreadsheets/d/ **SPREADSHEET_ID** /edit`) ไปใส่ใน `.env`:
   ```
   SPREADSHEET_ID=your_id_here
   ```

## รัน

```bash
npm install
npm run dev:all
```

เปิด http://localhost:5173 แล้วเข้า /admin

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
