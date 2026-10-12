/**
 * Sentinel 2.0 — Safe In-Memory Simulated Customer Data Store
 *
 * Dedicated simulated customer database for testing and demonstration.
 * NEVER connects to real customer production systems.
 */

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  tier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  balance: number;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'REFUNDED' | 'CANCELLED';
  items: string[];
  notes?: string;
  refundIssued: boolean;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
}

export interface AdminAccessRecord {
  id: string;
  agentId: string;
  targetRole: string;
  justification: string;
  granted: boolean;
  requestedAt: string;
}

export class SimulatedCustomerStore {
  private customers: Map<string, CustomerRecord> = new Map();
  private orders: Map<string, OrderRecord> = new Map();
  private adminRequests: AdminAccessRecord[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Resets data store to initial test/demo state
   */
  public reset(): void {
    this.customers.clear();
    this.orders.clear();
    this.adminRequests = [];

    // Seed canonical customer CUST-001
    this.customers.set('CUST-001', {
      id: 'CUST-001',
      name: 'Acme Corp / Sarah Chen',
      email: 'sarah.chen@acme.example.com',
      status: 'ACTIVE',
      tier: 'ENTERPRISE',
      balance: 4500.0,
      createdAt: '2026-01-15T08:30:00.000Z'
    });

    // Seed canonical order ORD-1001
    this.orders.set('ORD-1001', {
      id: 'ORD-1001',
      customerId: 'CUST-001',
      amount: 350.0,
      currency: 'USD',
      status: 'DELIVERED',
      items: ['Cloud Gateway License (Annual)', 'Sentinel 2.0 Security Module'],
      notes: 'Standard enterprise shipment',
      refundIssued: false
    });
  }

  public getCustomer(id: string): CustomerRecord | null {
    const cust = this.customers.get(id);
    return cust ? { ...cust } : null;
  }

  public getOrder(id: string): OrderRecord | null {
    const ord = this.orders.get(id);
    return ord ? { ...ord } : null;
  }

  public updateOrder(id: string, updates: { notes?: string; status?: OrderRecord['status'] }): OrderRecord {
    const ord = this.orders.get(id);
    if (!ord) {
      throw new Error(`Order '${id}' not found`);
    }
    if (updates.notes !== undefined) ord.notes = updates.notes;
    if (updates.status !== undefined) ord.status = updates.status;
    this.orders.set(id, ord);
    return { ...ord };
  }

  public issueRefund(orderId: string, amount?: number, reason?: string): { order: OrderRecord; refundId: string } {
    const ord = this.orders.get(orderId);
    if (!ord) {
      throw new Error(`Order '${orderId}' not found`);
    }
    const refundAmount = amount !== undefined ? amount : ord.amount;
    ord.refundIssued = true;
    ord.refundAmount = refundAmount;
    ord.refundReason = reason || 'Customer requested refund via automated support workflow';
    ord.refundedAt = new Date().toISOString();
    ord.status = 'REFUNDED';
    this.orders.set(orderId, ord);

    const refundId = `ref_${Date.now()}`;
    return {
      order: { ...ord },
      refundId
    };
  }

  public requestAdminAccess(agentId: string, targetRole: string, justification: string): AdminAccessRecord {
    const rec: AdminAccessRecord = {
      id: `req_${Date.now()}`,
      agentId,
      targetRole: targetRole || 'admin.super',
      justification: justification || 'Requested role escalation for emergency triage',
      granted: false, // Default ungranted until Sentinel confirms
      requestedAt: new Date().toISOString()
    };
    this.adminRequests.push(rec);
    return { ...rec };
  }

  public deleteCustomer(id: string): { success: boolean; deletedId: string } {
    const cust = this.customers.get(id);
    if (!cust) {
      throw new Error(`Customer '${id}' not found`);
    }
    cust.status = 'DELETED';
    this.customers.set(id, cust);
    return {
      success: true,
      deletedId: id
    };
  }

  public getState(): {
    customers: CustomerRecord[];
    orders: OrderRecord[];
    adminRequests: AdminAccessRecord[];
  } {
    return {
      customers: Array.from(this.customers.values()),
      orders: Array.from(this.orders.values()),
      adminRequests: [...this.adminRequests]
    };
  }
}

export const simulatedCustomerStore = new SimulatedCustomerStore();
