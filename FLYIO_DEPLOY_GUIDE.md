# Panduan Deploy ke Fly.io (Windows)

## Persiapan

1. Buat akun di https://fly.io (bisa pakai GitHub)
2. Install Fly.io CLI di Windows

### Cara Install flyctl di Windows

Buka **PowerShell sebagai Administrator**, lalu jalankan perintah berikut:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Setelah selesai, tutup dan buka kembali PowerShell, lalu cek:

```powershell
fly version
```

---

## Langkah Deploy

### 1. Login ke Fly.io

```powershell
fly auth login
```

Ikuti proses login di browser.

### 2. Masuk ke folder project

```powershell
cd "C:\Users\ASUS\Projects\desakalemago2-backend"
```

### 3. Launch aplikasi pertama kali

```powershell
fly launch
```

- Pilih **Yes** kalau ditanya "Would you like to deploy now?"
- Pilih region **Singapore (sin)** (paling cepat dari Indonesia)
- **PENTING**: Ketika ditanya apakah mau buat `fly.toml`, pilih **No** karena kita sudah punya file `fly.toml` yang sudah disiapkan.

Kalau `fly launch` membuat file baru, kamu bisa hapus dan pakai yang sudah ada.

### 4. Set Environment Variables (Secrets)

Ini sangat penting:

```powershell
# JWT Secret (WAJIB - generate dulu string acak panjang)
fly secrets set JWT_SECRET="PASTE_JWT_SECRET_YANG_SANGAT_PANJANG_DI_SINI"

# GitHub Token (sangat disarankan)
fly secrets set GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# GitHub Owner & Repo
fly secrets set GITHUB_OWNER="biskuitz"
fly secrets set GITHUB_REPO="desakalemago2"
```

**Cara generate JWT_SECRET yang kuat:**

Buka PowerShell lalu jalankan:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy hasilnya dan pakai untuk `JWT_SECRET`.

### 5. Deploy

Setelah secrets di-set, jalankan:

```powershell
fly deploy
```

Tunggu sampai selesai.

### 6. Cek Status & Logs

```powershell
fly status
fly logs
```

### 7. Buka Aplikasi

```powershell
fly open
```

Atau kunjungi: `https://desakalemago-backend.fly.dev` (nama app bisa berbeda)

---

## Penting untuk Kamu

- **Free Tier Fly.io**: Kamu bisa punya 3 VM gratis. Tapi resource-nya terbatas.
- Data kamu **aman** karena backend ini menyimpan data ke GitHub (`desakalemago2`), bukan ke disk server.
- Setelah deploy berhasil, **catat URL** backend yang baru, lalu kita akan update semua frontend.

---

## Perintah Berguna

```powershell
fly logs                    # Lihat log real-time
fly status                  # Cek status app
fly secrets list            # Lihat secrets yang sudah di-set
fly deploy                  # Deploy ulang
fly apps list               # Lihat semua app kamu
fly apps destroy <nama-app> # Hapus app (hati-hati!)
```

---

## Troubleshooting

**Error "Cannot find module"**  
→ Pastikan `node_modules` tidak ter-push ke Git. Kita sudah buat `.dockerignore`.

**App sering mati / cold start**  
→ Free tier Fly.io memang bisa seperti itu. Kalau butuh lebih stabil, nanti bisa upgrade ke paid plan kecil.

---

Setelah berhasil deploy dan kamu dapat URL baru, balas ke saya dengan URL-nya. Saya akan bantu update semua file frontend.
