export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="w-16 h-16 spinner border-4"></div>
      <p className="mt-4 text-gray-500 font-medium">Caricamento...</p>
    </div>
  )
}
