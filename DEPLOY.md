# Deployment Guide - Desa Kalemago Backend (Secure Version 2.0)

## ⚠️ Penting Sebelum Deploy

Backend ini sudah menggunakan sistem autentikasi yang **aman** (bcrypt + JWT). 
Jangan deploy versi lama yang masih pakai plain text password.

---

## 1. Environment Variables (WAJIB)

Buat file `.env` berdasarkan `.env.example`:

```env
PORT=3000
JWT_SECRET=PASTE_RANDOM_LONG_STRING_HERE
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=biskuitz
GITHUB_REPO=desakalemago2          # ← PENTING: Ini adalah repo FRONTEND (desakalemago2)
```

**Cara generate JWT_SECRET yang kuat:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 2. Rekomendasi Platform

### Pilihan Terbaik Saat Ini: **Render.com** (Recommended)

**Kelebihan:**
- Free tier lebih stabil daripada Railway free
- Mudah setup
- Auto deploy dari GitHub

**Langkah:**
1. Buka https://render.com
2. New → Web Service
3. Connect repository `BiskuitZ/desakalemago2-backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Tambahkan Environment Variables di dashboard Render (lihat bagian atas)
7. Deploy

### Alternatif: Railway

Jika tetap ingin pakai Railway:
- Project → New Service → Deploy from GitHub
- Tambahkan semua Environment Variables
- Setelah deploy, update URL di semua file frontend

---

## Penting: GITHUB_REPO Harus ke Repo Frontend

Backend ini dirancang untuk **menyimpan data** (user, produk, struktur tim, APBDes, dll) ke dalam repository **Frontend**, bukan ke repository Backend.

- `GITHUB_REPO` **harus** diisi dengan `desakalemago2` (repo frontend)
- Jangan isi `desakalemago2-backend`

Ini adalah arsitektur yang dipakai developer aslinya. Data akan di-push via GitHub API ke repo `desakalemago2`.

---

## 3. Update Frontend Setelah Deploy

Setelah backend berhasil di-deploy dan punya URL baru (contoh: `https://desakalemago-backend.onrender.com`):

### File yang harus diupdate:

1. **login.html**
2. **developer-dashboard.html**
3. **admin-dashboard.html** (jika ada protected calls)
4. **index.html**, **apbdes.html**, dll (untuk public data - biasanya tidak perlu token)

Cari dan ganti semua kemunculan:

```js
const API_URL = 'https://desakalemago2-backend-production.up.railway.app';
```

Menjadi:

```js
const API_URL = 'https://URL-BARU-KAMU.com';   // contoh: https://desakalemago-backend.onrender.com
```

---

## 4. Testing Setelah Deploy

1. Buka `/api/health` → harus return status ok
2. Login dengan `admin / admin123` → harus berhasil dan dapat token
3. Coba akses halaman Developer → harus bisa manage user & produk
4. Cek apakah data lama (population, APBDes, team) masih muncul

---

## 5. Catatan Keamanan

- Jangan pernah commit file `.env`
- JWT_SECRET harus berbeda antara development dan production
- GITHUB_TOKEN sebaiknya punya permission minimal (hanya repo yang dibutuhkan)
- Setelah deploy pertama, sebaiknya semua user login ulang supaya password mereka ter-hash

---

## Butuh Bantuan?

Hubungi developer yang mengerjakan refactor ini.

Versi backend ini jauh lebih aman daripada versi sebelumnya.
