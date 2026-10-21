# Resto System (Next.js + Tailwind)

Tampilan awal sistem resto dengan header, sidebar, dan dashboard.

## Tech Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS
- Heroicons React

## Menjalankan secara lokal
1. Install dependencies:
   ```bash
   npm install
   ```
2. Jalankan dev server:
   ```bash
   npm run dev
   ```
3. Buka http://localhost:3000

## Struktur Penting
- `src/app/layout.tsx` – kerangka layout dengan `Header` dan `Sidebar`.
- `src/app/page.tsx` – halaman `Dashboard`.
- `src/components/` – komponen UI: `Header`, `Sidebar`, `CardStat`, `QuickAction`.
- `src/app/globals.css` – import Tailwind + utilitas gaya global.

## Kustomisasi
- Warna gradasi sidebar dan header dapat diatur di `:root` pada `globals.css`.
- Navigasi sidebar diset di `src/components/Sidebar.tsx`.
