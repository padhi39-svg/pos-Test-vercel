// Database-based Transaction Store
export type TransactionItem = {
  id?: number
  barangId: number
  barangName?: string
  barangCode?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type Transaction = {
  id: number
  transactionCode: string
  customerId: number | null
  customerName?: string
  customerCode?: string
  subtotal: number
  discountAmount: number
  total: number
  paymentMethod: string
  paymentAmount: number
  changeAmount: number
  status: string
  items: TransactionItem[]
  createdAt: string
  updatedAt: string
}

const API_BASE = '/api'

// Get all transactions
export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(`${API_BASE}/transactions`)
    if (!response.ok) throw new Error('Failed to fetch transactions')
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

// Get transaction by ID
export async function getTransactionById(id: number): Promise<Transaction | undefined> {
  try {
    const response = await fetch(`${API_BASE}/transactions/${id}`)
    if (!response.ok) return undefined
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching transaction by ID:', error)
    return undefined
  }
}

// Create new transaction
export async function createTransaction(data: {
  customerId?: number | null
  subtotal: number
  discountAmount?: number
  total: number
  paymentMethod?: string
  paymentAmount?: number
  changeAmount?: number
  status?: string
  items: TransactionItem[]
}): Promise<Transaction> {
  try {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) throw new Error('Failed to create transaction')
    
    return await response.json()
  } catch (error) {
    console.error('Error creating transaction:', error)
    throw error
  }
}

// Get sales report
export async function getSalesReport(startDate?: string, endDate?: string): Promise<any> {
  try {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    
    const response = await fetch(`${API_BASE}/reports/sales?${params}`)
    if (!response.ok) throw new Error('Failed to fetch sales report')
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching sales report:', error)
    return null
  }
}
