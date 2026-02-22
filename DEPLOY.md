# 🚀 คู่มือ Deploy Server ที่หนองมะโมง ชัยนาท

## 📍 ตัวเลือก Cloud Providers ที่ใกล้ที่สุด

### 1. **Vercel (แนะนำ) - Singapore Region**
- ⚡ เร็วที่สุดสำหรับไทย (Singapore edge)
- ✅ ฟรี tier ดี
- ✅ Deploy ง่าย
- 📍 Region: `sin1` (Singapore)

**วิธี Deploy:**
```bash
# ติดตั้ง Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# ตั้งค่า Environment Variable
vercel env add GOOGLE_CREDENTIALS
# (วาง credentials.json ทั้งหมด)
```

**หรือ Deploy ผ่านเว็บ:**
1. ไปที่ https://vercel.com
2. Import project จาก GitHub
3. ตั้งค่า:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. เพิ่ม Environment Variable: `GOOGLE_CREDENTIALS` (วาง credentials.json)

---

### 2. **Railway - Singapore**
- ⚡ เร็วดี
- ✅ ฟรี $5/เดือน
- 📍 Region: Singapore

**วิธี Deploy:**
```bash
# ติดตั้ง Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway init
railway up
```

---

### 3. **Render - Singapore**
- ⚡ เร็วดี
- ✅ ฟรี tier
- 📍 Region: Singapore

**วิธี Deploy:**
1. ไปที่ https://render.com
2. สร้าง Web Service
3. Connect GitHub repo
4. ตั้งค่า:
   - Build Command: `npm run build`
   - Start Command: `node api/index.js`
   - Environment: Node

---

### 4. **AWS EC2 - Singapore**
- ⚡ เร็วมาก (ควบคุมได้เต็มที่)
- 💰 ต้องจ่าย (~$5-10/เดือน)
- 📍 Region: ap-southeast-1 (Singapore)

---

## ⚙️ การตั้งค่าสำหรับ Production

### 1. Environment Variables
ตั้งค่าใน Vercel/Railway/Render:
```
SPREADSHEET_ID=<รหัสจาก URL ของ Google Sheet>
GOOGLE_CREDENTIALS=<credentials.json content>
PORT=3000
```

### 2. Google Sheets API
- ตรวจสอบว่า service account มีสิทธิ์เข้าถึง Google Sheets
- ตรวจสอบ quota ใน Google Cloud Console

### 3. CORS Settings
ถ้า deploy แล้วมีปัญหา CORS ให้ตรวจสอบ:
- ตั้งค่า allowed origins ใน `api/index.js`

---

## 🎯 วิธี Deploy เร็วที่สุด (Vercel)

### Step 1: เตรียมไฟล์
```bash
# ตรวจสอบว่าไฟล์พร้อม
ls -la vercel.json
ls -la api/index.js
```

### Step 2: Deploy
```bash
vercel --prod
```

### Step 3: ตั้งค่า Environment
```bash
# Copy credentials.json content
cat credentials.json

# Add to Vercel
vercel env add GOOGLE_CREDENTIALS production
# (วาง JSON content)
```

### Step 4: Redeploy
```bash
vercel --prod
```

---

## 📊 เปรียบเทียบความเร็ว

| Provider | Region | Latency จากไทย | ราคา |
|----------|--------|----------------|------|
| Vercel | Singapore | ~30-50ms | ฟรี |
| Railway | Singapore | ~30-50ms | $5/เดือน |
| Render | Singapore | ~30-50ms | ฟรี |
| AWS | Singapore | ~20-40ms | ~$5-10/เดือน |

---

## ✅ Checklist ก่อน Deploy

- [ ] ตั้งค่า `USE_MOCK_DATA = false` ใน `api/index.js`
- [ ] ตรวจสอบ `credentials.json` มีอยู่
- [ ] ตั้งค่า Environment Variable `GOOGLE_CREDENTIALS`
- [ ] ทดสอบ build: `npm run build`
- [ ] ตรวจสอบ `.gitignore` ไม่ commit `credentials.json`

---

## 🔗 Links ที่เกี่ยวข้อง

- Vercel: https://vercel.com
- Railway: https://railway.app
- Render: https://render.com
- Google Cloud Console: https://console.cloud.google.com

---

**หมายเหตุ:** Vercel จะ deploy ไปที่ Singapore region (`sin1`) อัตโนมัติตาม `vercel.json` ที่ตั้งค่าไว้แล้ว
