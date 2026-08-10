# PRD — Splitr: Pay & Split Bills on Stellar

> **Untuk AI coding assistant:** Dokumen ini adalah Product Requirements Document untuk aplikasi Splitr. Bangun sesuai spesifikasi di sini. Prioritaskan Milestone MVP (bagian 9) lebih dulu. Konteksnya: builder adalah pemula, dibangun bertahap untuk program Stellar Journey to Mastery (belt progression). Tanyakan bila ada keputusan teknis yang ambigu sebelum menulis kode besar.

---

## 1. Ringkasan Produk

**Splitr** adalah aplikasi pembayaran dan bagi tagihan berbasis stablecoin di **Stellar**, dibuat untuk komunitas, arisan, dan UMKM di Indonesia. Produk ini mengubah patungan grup yang berantakan (transfer manual + chat) menjadi satu sistem: hitung otomatis siapa berutang berapa, tagih, dan buktikan lunas secara transparan on-chain.

**Kategori:** Payments + Stablecoins (jaringan Stellar).
**Pasar awal:** Indonesia.
**Platform target:** Web app (mobile-first responsive) untuk MVP.

## 2. Masalah

Membagi dan menagih uang dalam grup masih manual dan rawan salah:
- Bagi tagihan pakai kalkulator, sering salah kalau porsi tiap orang beda.
- Menagih lewat WhatsApp — pesan tenggelam, tidak ada status siapa sudah bayar.
- Bukti bayar berupa screenshot yang bisa dipalsukan atau salah rekening.
- Pelacakan tercecer di buku tulis, Excel, dan Notes — tidak sinkron.
- Bendahara grup menanggung beban administrasi + rasa canggung menagih teman.

## 3. Positioning (penting)

Transfer bank lokal (BI-FAST) di Indonesia **sudah instan dan gratis**. Karena itu keunggulan Splitr **BUKAN kecepatan kirim uang**, melainkan:

> Cara sekarang menyelesaikan *"gimana caranya kirim uang."* Splitr menyelesaikan *"siapa berutang berapa, sudah bayar belum, dan bisa dibuktikan."*

Splitr = **sistem penyelesaian tagihan grup**, bukan sekadar alat kirim uang. Fokus nilai: **koordinasi, transparansi, dan bukti** — bukan kecepatan transfer.

## 4. Target Pengguna & Persona

**Persona utama — "Rani", 26, pekerja kantoran di Jakarta.** Bendahara tak resmi di beberapa grup: geng nongkrong, arisan keluarga, patungan kos. Dia yang sering nalangin dulu, lalu menagih orang lain, mencatat manual, dan menanggung drama "aku sudah transfer kok".

Segmen pengguna:
- Grup teman: patungan makan, trip, kado.
- Arisan & kas komunitas/RT.
- UMKM kecil (warung, jasa) yang butuh tagih & terima bayar sederhana.

## 5. Keunggulan vs Cara Lama

| Masalah cara lama | Solusi Splitr di Stellar |
|---|---|
| Bagi tagihan manual pakai kalkulator | Split otomatis dalam grup |
| Nagih lewat chat, pesan tenggelam | Payment request tercatat, status per orang |
| Screenshot bukti transfer (bisa dipalsukan) | Pembayaran tercatat transparan on-chain |
| Transfer bank manual, kadang kena biaya admin | Kirim stablecoin di Stellar — biaya rendah, cepat |
| Catatan tercecer di buku/Excel | Riwayat pembayaran otomatis dari transaksi on-chain |
| Bendahara harus ingat & nagih berulang | Tagihan & pengingat jadi tugas aplikasi |

## 6. Aha Moment & Aktivasi (WAJIB diprioritaskan)

**Momen paling penting di kunjungan pertama:** user berhasil **membuat grup → menambah satu tagihan → melihat aplikasi otomatis menghitung "siapa berutang berapa" → mengirim tagihan ke temannya.**

Momen "aha" inti: **melihat split otomatis muncul dengan benar.**

Prinsip desain aktivasi:
- Aha moment **tidak boleh bergantung** pada teman sudah membayar dulu. User harus merasakan nilai sendirian, di menit pertama.
- **JANGAN** memaksa connect wallet / punya stablecoin sebelum user merasakan nilai. Biarkan mereka buat grup & lihat split dulu; minta hal teknis Web3 setelahnya.
- Untuk pengguna Indonesia yang baru kenal crypto, minimalkan hambatan awal.

**Metrik aktivasi utama:** % user baru yang berhasil membuat 1 grup + 1 split di sesi pertama.

## 7. Fitur (Bertahap Sesuai Belt)

**MVP (Green Belt):**
- Buat grup, tambah anggota.
- Buat tagihan; split rata atau custom (porsi berbeda per orang).
- Tandai lunas; riwayat pembayaran.

**Growth (Blue Belt):**
- Notifikasi & payment request (minta bayar).
- Dashboard sederhana untuk pemilik grup (status per orang).

**Scale & Mainnet (Black Belt):**
- Tagihan berulang otomatis.
- Fitur UMKM (katalog/invoice sederhana).
- Launch di Stellar Mainnet.

## 8. Arsitektur Teknis (target)

- **Frontend:** web app (React), mobile-first responsive.
- **Blockchain:** Stellar. Pembayaran = transfer stablecoin (bukan transfer bank).
- **Smart contract:** Soroban (Rust) untuk logika grup & split.
- **Bukti lunas:** transaksi on-chain yang bisa diverifikasi siapa pun.
- **Jaringan:** mulai di **testnet** (MVP), naik ke **mainnet** (Black Belt).
- **On/off-ramp Rupiah:** via Stellar Anchor — **di luar scope MVP**, rencana jangka panjang (bisa integrasi ke infrastruktur ramp pihak ketiga, mis. sejenis KailoPay, alih-alih membangun anchor sendiri).

**Catatan jujur untuk implementasi:** di tahap testnet/MVP, pembayaran memakai stablecoin uji, **belum** Rupiah sungguhan dari rekening bank. Rancang lapisan pembayaran agar mudah disambungkan ke ramp Rupiah nanti.

## 9. Milestone Pembangunan (urutan kerja untuk AI)

1. **Fondasi:** setup wallet Stellar (buat/koneksi), tampilkan saldo testnet.
2. **Core split (MVP):** buat grup → tambah anggota → buat tagihan → hitung split (rata & custom) → tampilkan "siapa berutang berapa". *(Ini aha moment — buat mulus & tanpa gesekan.)*
3. **Payment request:** kirim tagihan ke anggota; status per orang (belum/lunas).
4. **Settlement:** bayar via transfer stablecoin testnet; catat sebagai bukti on-chain.
5. **Riwayat & dashboard:** riwayat pembayaran otomatis; dashboard pemilik grup.
6. **(Nanti)** recurring bills, fitur UMKM, mainnet, ramp Rupiah.

## 9a. Skema Data Sederhana (MVP)

Model data minimal untuk MVP. Gunakan ini sebagai titik awal; sesuaikan tipe sesuai stack (mis. `id` bisa UUID string).

**Group** — satu grup patungan (geng, arisan, kos).
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | ID unik grup |
| name | string | Nama grup (mis. "Geng Nongkrong") |
| ownerId | string | Member yang membuat grup |
| createdAt | datetime | Waktu dibuat |

**Member** — anggota dalam sebuah grup.
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | ID unik member |
| groupId | string | Relasi ke Group |
| name | string | Nama tampilan |
| stellarAddress | string \| null | Alamat wallet Stellar (opsional saat awal — jangan wajibkan di aktivasi) |

**Bill** — satu tagihan yang dibagi dalam grup.
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | ID unik tagihan |
| groupId | string | Relasi ke Group |
| title | string | Deskripsi (mis. "Makan Sabtu") |
| totalAmount | number | Total tagihan |
| currency | string | Mis. "USDC" (testnet) |
| paidById | string | Member yang menalangi/membayar dulu |
| splitType | enum | `equal` \| `custom` |
| createdAt | datetime | Waktu dibuat |

**BillShare** — porsi utang tiap member atas sebuah Bill (hasil split).
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | ID unik share |
| billId | string | Relasi ke Bill |
| memberId | string | Member yang berutang |
| amountOwed | number | Jumlah yang harus dibayar member ini |
| status | enum | `pending` \| `paid` |

**Payment** — bukti penyelesaian sebuah BillShare.
| Field | Tipe | Keterangan |
|---|---|---|
| id | string | ID unik pembayaran |
| billShareId | string | Relasi ke BillShare |
| fromMemberId | string | Pembayar |
| amount | number | Jumlah dibayar |
| stellarTxHash | string \| null | Hash transaksi Stellar (bukti on-chain; null jika belum settle) |
| paidAt | datetime | Waktu bayar |

**Relasi:** Group `1—*` Member · Group `1—*` Bill · Bill `1—*` BillShare · BillShare `1—1` Payment (opsional).

**Catatan aktivasi:** langkah "buat grup → tambah Bill → generate BillShare (split)" harus bisa jalan **tanpa** `stellarAddress` atau `Payment` terisi — itulah aha moment. `stellarTxHash` & `Payment` menyusul di tahap settlement.

## 10. Non-Goals (di luar scope MVP)

- On/off-ramp Rupiah langsung dari bank.
- KYC / lisensi regulasi.
- Mobile app native (iOS/Android).
- Deployment mainnet (baru di Black Belt).

## 11. Target Program (konteks, bukan requirement teknis)

- 50 user aktif (Blue Belt).
- 30+ user baru & 20+ user mainnet nyata (Black Belt).
- Kandidat funding: InstaAward (s.d. $15.000), Stellar Community Fund (s.d. $150.000).

---
*Drafted with Dia*
