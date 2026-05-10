# Integrasi Frontend-Backend

## Langkah 1
Jalankan backend:
cd backend
npm install
npm start

## Langkah 2
Buka login.html di browser

## API
http://localhost:3000/api/auth/login

## Contoh Fetch
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username, password})
})