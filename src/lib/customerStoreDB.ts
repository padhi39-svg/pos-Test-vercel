// Database-based Customer Store
export type Customer = {
  id: number
  code: string
  name: string
  address: string
  phone: string
  discountPercent: number
  isdelete: boolean
  createdAt: string
  updatedAt: string
  jenisCustomerId: number | null
}

const API_BASE = '/api'

// Get all customers
export async function getAllCustomers(includeDeleted = false): Promise<Customer[]> {
  try {
    const response = await fetch(`${API_BASE}/customer`)
    if (!response.ok) throw new Error('Failed to fetch customers')
    
    const data = await response.json()
    return includeDeleted ? data : data.filter((item: Customer) => !item.isdelete)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return []
  }
}

// Get customer by ID
export async function getCustomerById(id: number): Promise<Customer | undefined> {
  try {
    const response = await fetch(`${API_BASE}/customer/${id}`)
    if (!response.ok) return undefined
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching customer by ID:', error)
    return undefined
  }
}

// Add new customer
export async function addCustomer(data: Omit<Customer, 'id' | 'isdelete' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
  try {
    const response = await fetch(`${API_BASE}/customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) throw new Error('Failed to create customer')
    
    return await response.json()
  } catch (error) {
    console.error('Error creating customer:', error)
    throw error
  }
}

// Update customer
export async function updateCustomer(id: number, data: Partial<Customer>): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/customer/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) throw new Error('Failed to update customer')
  } catch (error) {
    console.error('Error updating customer:', error)
    throw error
  }
}

// Soft delete customer
export async function softDeleteCustomer(id: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/customer/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) throw new Error('Failed to delete customer')
  } catch (error) {
    console.error('Error deleting customer:', error)
    throw error
  }
}
