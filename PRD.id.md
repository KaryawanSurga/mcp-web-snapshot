# PRD — MCP Web Snapshot (Bahasa Indonesia)

**Status:** v0.2.0 siap rilis
**Owner:** KaryawanSurga
**Update terakhir:** 2026-09-26

## 1. Ringkasan

MCP Web Snapshot adalah MCP server dan CLI yang mengambil halaman web lalu mengembalikan markdown bersih yang siap dibaca LLM: konten utama diekstrak, elemen chrome dibuang, link diresolusi, output dipangkas sesuai token budget. Tujuannya: agent bisa membaca web tanpa membanjiri context dengan HTML mentah.

## 2. Masalah

- Agent terus-menerus membaca dokumentasi, artikel, issue, dan changelog.
- HTML mentah sebagian besar adalah chrome: navigasi, iklan, script, banner cookie, markup tracking.
- Memberi halaman mentah ke model membuang token, uang, dan perhatian, sekaligus mengubur konten aslinya.
- Script scraping ad-hoc diduplikasi di setiap project agent dan jarang menangani timeout, batas ukuran, atau content type.

## 3. Target pengguna

- Developer yang agent-nya meneliti dokumentasi dan sumber web.
- Pembuat agent yang butuh primitif pembaca web yang andal.
- Tim yang memantau biaya context per sesi.

## 4. Tujuan (v0.1.0)

1. Satu panggilan (atau satu perintah) mengubah URL menjadi markdown bersih.
2. Ekstraksi konten utama dengan fallback yang bisa diprediksi untuk halaman non-artikel.
3. Resolusi link absolut dan ekstraksi link opsional.
4. Token budgeting eksplisit dengan laporan pemotongan.
5. Fetch yang aman: timeout, batas ukuran, validasi content-type, hanya http/https.
6. Pemrosesan sepenuhnya offline — satu-satunya aktivitas jaringan adalah fetch halaman yang diminta.

## 5. Bukan tujuan

- Rendering JavaScript; v0.1.0 hanya membaca HTML server-rendered.
- Crawling, penelusuran sitemap, atau scraping seluruh situs.
- Sesi browser, cookie, autentikasi, atau bypass paywall.
- Parsing PDF, gambar, atau dokumen biner di v0.1.0.
- Mesin pencari atau penemuan konten.

## 6. User story

- Sebagai agent, saya mau membaca halaman dokumentasi sebagai markdown supaya token saya tidak habis untuk HTML.
- Sebagai developer, saya mau snapshot changelog atau release notes dalam satu perintah CLI.
- Sebagai agent, saya mau daftar link di halaman supaya bisa memutuskan bacaan berikutnya.
- Sebagai lead tim, saya mau pembacaan halaman dibatasi budget, bukan dump tanpa batas.

## 7. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR1 | `snapshot` mengambil URL dan mengembalikan judul, metadata sumber, markdown, jumlah token, dan status pemotongan. |
| FR2 | Ekstraksi konten utama memakai Mozilla Readability dengan fallback ke seluruh halaman. |
| FR3 | HTML dikonversi ke markdown dengan link dan gambar relatif diresolusi terhadap URL final. |
| FR4 | `extract_links` mengembalikan link absolut unik beserta teksnya, opsional hanya same-origin. |
| FR5 | `--budget` memangkas output dan melaporkan pemotongan secara eksplisit. |
| FR6 | Request menegakkan timeout dan batas ukuran download. |
| FR7 | Hanya URL `http` dan `https` yang diterima. |
| FR8 | `serve` mengekspos kedua tool lewat MCP stdio. |
| FR9 | Respons teks non-HTML dikembalikan apa adanya, hanya dipangkas oleh budget. |
| FR10 | `--adaptive` menyimpan fingerprint kontainer konten secara lokal dan memulihkannya lewat skor kemiripan saat halaman didesain ulang; memori per domain, dibatasi, dan tidak pernah keluar dari mesin. |

## 8. Kebutuhan non-fungsional

- Ekstraksi deterministik untuk halaman dan opsi yang sama.
- Tanpa cookie, kredensial, eksekusi JavaScript, atau telemetry.
- Node >= 20; dependency runtime hanya MCP SDK, readability, linkedom, turndown, dan zod.
- Semua jalur fetch memiliki timeout; tidak ada request menggantung.
- Test berjalan sepenuhnya offline melawan fixture HTTP lokal.

## 9. Metrik sukses

- Pengguna mengganti script scraping ad-hoc dengan tool ini.
- Diadopsi di config MCP publik dan dotfiles agent.
- Install npm dan star GitHub naik dari minggu ke minggu.
- Muncul permintaan fitur cache dan PDF (sinyal pemakaian nyata).

## 10. Catatan teknis

- `@mozilla/readability` di atas DOM linkedom menghindari dependency jsdom yang berat.
- Rule Turndown meresolusi link dan gambar serta membuang URL `javascript:`.
- Pembacaan body dibatasi content-length bila ada, dan dipotong saat chunked.
- Estimasi token memakai empat karakter per token; mode exact ada di roadmap.

## 11. Rencana rilis

- **v0.1.0** — snapshot, extract_links, budgeting, CLI, MCP server, CI (rilis 2026-09-19).
- **v0.2.0** — adaptive extraction: fingerprint konten, memori lokal, pemulihan berbasis kemiripan setelah redesign (rilis 2026-09-20).
- **v0.3.0** — cache lokal dengan TTL, kesopanan robots-aware, deteksi kontainer semantik untuk adaptive extraction.
- **v0.4.0** — dokumen PDF/teks, snapshot batch, mode tokenizer exact.

## 12. Pertanyaan terbuka

- Apakah default budget 4000 token sudah tepat?
- Perlukah caching opt-in atau default dengan TTL?
- Perlukah `extract_links` menawarkan crawling kedalaman satu?
