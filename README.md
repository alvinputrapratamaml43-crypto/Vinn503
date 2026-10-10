# VINN503 Downloader V3

## Fitur
- Downloader link publik YouTube dan TikTok melalui `yt-dlp`.
- Pemilihan kualitas media sesuai format yang disediakan sumber; hasil 4K tidak bisa dibuat bila sumber tidak memiliki resolusi tersebut.
- Pemrosesan video upload melalui FFmpeg.
- Peningkatan foto di browser menggunakan TensorFlow.js dan UpscalerJS ESRGAN.
- Fitur AM Premium dengan magic link promo sekali pakai yang dibuat dari Admin Dashboard.
- Tampilan diperhalus dengan animasi lebih tenang dan dukungan reduced motion.
- Animasi loading dan video sambutan pada halaman utama.

## Menjalankan
1. Pasang Node.js, `yt-dlp` versi terbaru, dan FFmpeg pada server.
2. Jalankan `npm install`.
3. Jalankan `npm start`.

## AM Premium / Magic Link
1. Atur `ADMIN_PASSWORD` pada environment server.
2. Buka `/admin`, login, lalu buat magic link dan pilih durasinya.
3. Bagikan link kepada pengguna. Token hanya dapat diklaim satu kali dan status Premium disimpan server untuk ID browser/perangkat.
4. Karena versi ini belum memiliki akun pengguna, Premium terikat pada browser/perangkat yang mengklaim. Menghapus data browser atau berganti perangkat dapat menghilangkan identitas perangkat. Untuk produksi yang lebih kuat, gunakan login akun dan database persisten.
5. Pada hosting dengan filesystem sementara, pasang persistent disk untuk menyimpan `premium-data.json` dan `bug-reports.json` agar data tidak hilang saat deploy/restart.

## Catatan
Downloader hanya dapat mengakses konten publik yang dapat diambil oleh `yt-dlp`; link privat, login-gated, region-restricted, atau perubahan platform mungkin gagal. Gunakan hanya konten yang kamu miliki atau berizin untuk mengunduh.

Video sambutan disetel tanpa kontrol, tanpa klik, tanpa picture-in-picture, dan tanpa tombol unduh standar browser. Ini hanya mengurangi interaksi biasa, bukan DRM: pengguna tetap dapat merekam layar atau mengambil URL media dari jaringan. Untuk proteksi kuat, gunakan DRM/streaming berlisensi atau jangan sajikan file publik langsung.


## VINN AI (Gemini API)
VINN AI uses Google's Gemini API. Create an API key in Google AI Studio and keep it secret on the server. Do not put the key in HTML/JavaScript.

Termux example (paste your own key locally; do not share it):
```bash
export GEMINI_API_KEY='PASTE_API_KEY_DI_SINI'
npm start
```
Free-tier availability and rate limits depend on Google's current terms and account/region. Never publish this environment variable in a public repository.

## Publikasi / deployment
- Gunakan `GEMINI_API_KEY` dan `ADMIN_PASSWORD` sebagai environment variables di dashboard hosting; jangan commit nilai rahasia ke Git.
- Atur `GEMINI_MODEL` ke model yang tersedia pada project/key Google AI Studio.
- Endpoint publik diberi throttling sederhana per IP dan sesi admin berakhir setelah 8 jam. Untuk deployment multi-instance, gunakan rate-limit store bersama dan autentikasi admin yang lebih kuat.
- Upload video dibatasi 100 MB dan hanya menerima MIME video umum. Batas hosting/ingress mungkin lebih kecil.
- Gunakan persistent disk untuk `downloads`, `uploads`, `bug-reports.json`, dan `premium-data.json` bila ingin data bertahan; bersihkan file unduhan lama secara terjadwal.
- Build Docker membutuhkan akses internet saat build dan memasang tool pihak ketiga. Uji build/deploy di platform target sebelum mengumumkan website siap produksi.
