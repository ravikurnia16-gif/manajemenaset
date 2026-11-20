# API KM Akhir Ambulance

Endpoint untuk mendapatkan kilometer akhir (odometer terakhir) tiap ambulance. Wajib menyertakan token API.

## Autentikasi

Kirim token pada header `Authorization` dengan format `Bearer`:

```
Authorization: Bearer <token>
```

Token diberikan oleh pengelola DEIPED. Simpan di sisi server aplikasi Anda; jangan ditaruh di kode yang berjalan di browser/aplikasi pengguna.

## Endpoint

```
GET /ambulance/vehicles
```

- Tanpa parameter.
- Respons tidak di-cache, jadi selalu berisi data terbaru.

## Contoh

```bash
curl https://<host>/ambulance/vehicles \
  -H "Authorization: Bearer <token>"
```

Respons `200 OK`:

```json
{
  "status": "success",
  "data": {
    "vehicles": [
      {
        "id": "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b",
        "name": "Ambulance 1",
        "plate_number": "B 1234 XX",
        "last_km": 45210
      }
    ]
  }
}
```

Bila tidak ada ambulance aktif, `vehicles` berupa array kosong (`[]`).

## Field

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | string (UUID) | ID ambulance |
| `name` | string | Nama ambulance |
| `plate_number` | string | Plat nomor |
| `last_km` | integer | KM akhir (odometer terakhir), dalam kilometer |

## Catatan

- Hanya ambulance aktif yang ditampilkan.
- `last_km` hanya dihitung dari perjalanan yang sudah diverifikasi. Perjalanan yang masih berjalan, menunggu verifikasi, ditolak, atau dibatalkan tidak dihitung, sehingga angka ini bisa tertinggal sedikit dari kondisi odometer sebenarnya.
- Ambulance yang belum punya perjalanan terverifikasi menampilkan KM awal saat didaftarkan.

## Error

Semua error berbentuk `{"status":"error","message":"..."}`.

| Status | Penyebab |
|---|---|
| `401` | Header `Authorization` tidak ada, bukan format `Bearer`, atau token salah |
| `429` | Terlalu banyak request; coba lagi beberapa saat |
| `500` | Kesalahan server |
| `503` | Endpoint belum diaktifkan di server; hubungi pengelola |
