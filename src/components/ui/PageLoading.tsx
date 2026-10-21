export default function PageLoading() {
  return (
    <div className="h-[calc(100vh-40px)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-teal-primary rounded-full border-t-transparent animate-spin" />
        <div className="text-sm text-slate-500">Memuat...</div>
      </div>
    </div>
  )
}
