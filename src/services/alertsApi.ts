// Alert API service for NEUROVEST
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
export interface Alert {
  _id: string;
  symbol: string;
  condition: 'above' | 'below' | 'crosses_up' | 'crosses_down';
  targetPrice: number;
  currentPrice: number;
  notificationChannels: string[];
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface AlertStats {
  total: number;
  active: number;
  triggered: number;
  inactive: number;
  bySymbol: Record<string, number>;
}

// Helper function to get auth headers
function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// Get all alerts
export async function getAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch(`${API_URL}/api/alerts`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Get active alerts
export async function getActiveAlerts(): Promise<Alert[]> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/active`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Create alert
export async function createAlert(
  symbol: string,
  condition: 'above' | 'below' | 'crosses_up' | 'crosses_down',
  targetPrice: number,
  notificationChannels: string[] = ['push']
): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ symbol, condition, targetPrice, notificationChannels })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete alert
export async function deleteAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Deactivate alert
export async function deactivateAlert(alertId: string): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/${alertId}/deactivate`, {
      method: 'POST',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Reactivate alert
export async function reactivateAlert(alertId: string): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/${alertId}/reactivate`, {
      method: 'POST',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Update alert
export async function updateAlert(
  alertId: string,
  updates: Partial<Alert>
): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Create smart alert
export async function createSmartAlert(
  symbol: string,
  indicatorType: string,
  threshold?: number
): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/smart`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ symbol, indicatorType, threshold })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Create alert from command
export async function createAlertFromCommand(command: string): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/command`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ command })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, alert: data.alert };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get alert stats
export async function getAlertStats(): Promise<AlertStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/stats`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Get triggered alerts
export async function getTriggeredAlerts(limit: number = 50): Promise<Alert[]> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/triggered?limit=${limit}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Bulk delete alerts
export async function bulkDeleteAlerts(alertIds: string[]): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/alerts/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ alertIds })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, deletedCount: data.deletedCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
