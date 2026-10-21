/**
 * Notification utility for showing success/error messages
 * Provides consistent user feedback across all CRUD operations
 */

export const showSuccess = (message: string) => {
  alert(`✅ ${message}`)
}

export const showError = (message: string) => {
  alert(`❌ ${message}`)
}

export const showWarning = (message: string) => {
  alert(`⚠️ ${message}`)
}

export const showInfo = (message: string) => {
  alert(`ℹ️ ${message}`)
}

/**
 * Standard CRUD success messages
 */
export const CrudMessages = {
  created: (entityName: string) => `Data ${entityName} berhasil disimpan!`,
  updated: (entityName: string) => `Data ${entityName} berhasil diubah!`,
  deleted: (entityName: string) => `Data ${entityName} berhasil dihapus!`,
  imported: (entityName: string, count: number) => `${count} data ${entityName} berhasil diimpor!`,
  exported: (entityName: string, count: number) => `${count} data ${entityName} berhasil diekspor!`,
}

/**
 * Standard CRUD error messages
 */
export const CrudErrors = {
  createFailed: (entityName: string) => `Gagal menyimpan ${entityName}`,
  updateFailed: (entityName: string) => `Gagal mengubah ${entityName}`,
  deleteFailed: (entityName: string) => `Gagal menghapus ${entityName}`,
  loadFailed: (entityName: string) => `Gagal memuat ${entityName}`,
  importFailed: (entityName: string) => `Gagal mengimpor ${entityName}`,
  exportFailed: (entityName: string) => `Gagal mengekspor ${entityName}`,
  duplicateCode: (code: string) => `Kode ${code} sudah digunakan`,
  notFound: (entityName: string) => `Data ${entityName} tidak ditemukan`,
  invalidData: () => `Data tidak valid`,
  networkError: () => `Terjadi kesalahan jaringan`,
}

/**
 * Helper function for handling API responses with notifications
 */
export const handleApiResponse = async <T>(
  response: Response,
  successMessage: string,
  errorMessage: string
): Promise<T | null> => {
  try {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      showError(error?.error || errorMessage)
      return null
    }
    
    const data = await response.json()
    showSuccess(successMessage)
    return data as T
  } catch (error) {
    console.error('API Response Error:', error)
    showError(errorMessage)
    return null
  }
}

/**
 * Wrapper for CRUD operations with consistent error handling
 */
export const withNotification = async <T>(
  operation: () => Promise<T>,
  successMessage: string,
  errorMessage: string
): Promise<T | null> => {
  try {
    const result = await operation()
    showSuccess(successMessage)
    return result
  } catch (error: any) {
    console.error('Operation Error:', error)
    showError(error?.message || errorMessage)
    return null
  }
}
