export default function BarangPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Barang</h1>
      <p className="text-slate-500 text-xs">Kelola data barang restoran Anda.</p>
      <div className="pt-2">
        <a
          href="/api/barang/export"
          className="inline-flex items-center px-3 py-2 text-sm font-medium rounded bg-teal-primary hover:bg-teal-dark text-white"
        >
          Export Excel (CSV)
        </a>
        <p className="text-[11px] text-slate-400 mt-1">
          Kolom: kode, nama barang, spesifikasi, kategori, harga jual, satuan1/rasio1, satuan2/rasio2, satuan3/rasio3, aktif, tampilmenu.
        </p>
      </div>
    </div>
  )
}
