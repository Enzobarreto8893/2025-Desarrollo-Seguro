// src/services/invoiceService.ts
import db from '../db';
import { Invoice } from '../types/invoice';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface InvoiceRow {
  id: string;
  userId: string;
  amount: number;
  dueDate: Date;
  status: string;
}

const ALLOWED_OPERATORS = new Set(['=', '!=']);

// Allowlist fijo de proveedores: mapear claves a URLs seguras
const PAYMENT_BRANDS: Record<string, string> = {
  visa: 'https://payments.example-visa.com/payments',
  mastercard: 'https://payments.example-mastercard.com/payments',
  // agregar otros proveedores conocidos aquí
};

// Directorio base seguro para recibos (asegurarse de configurar en .env en dev/prod)
const INVOICE_RECEIPT_DIR = process.env.INVOICE_RECEIPT_DIR || path.resolve('/var', 'invoices');

class InvoiceService {
  static async list(userId: string, status?: string, operator?: string): Promise<Invoice[]> {
    // Base query: siempre filtrar por userId para evitar enumeración
    let q = db<InvoiceRow>('invoices').where({ userId });

    // Evitar concatenaciones: sólo permitir operadores conocidos
    if (status && operator && ALLOWED_OPERATORS.has(operator)) {
      if (operator === '=') {
        q = q.andWhere('status', status);
      } else if (operator === '!=') {
        q = q.andWhereNot('status', status);
      }
    }

    const rows = await q.select();
    const invoices = rows.map(row => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status
    } as Invoice));
    return invoices;
  }

  static async setPaymentCard(
    userId: string,
    invoiceId: string,
    paymentBrand: string,
    ccNumber: string,
    ccv: string,
    expirationDate: string
  ) {
    // Verificar que la factura existe y pertenece al usuario antes de procesar el pago
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId, userId }).first();
    if (!invoice) {
      throw new Error('Invoice not found or not accessible');
    }

    // Validar proveedor contra allowlist
    const paymentUrl = PAYMENT_BRANDS[paymentBrand];
    if (!paymentUrl) {
      throw new Error('Invalid payment brand');
    }

    // Hacer la petición de pago a la URL mapeada (HTTPS preferible). Añadir timeout y manejo de errores.
    let paymentResponse;
    try {
      paymentResponse = await axios.post(
        paymentUrl,
        { ccNumber, ccv, expirationDate },
        { timeout: 5000 } // timeout en ms
      );
    } catch (err) {
      // logear y normalizar el error
      console.error('Payment provider request failed:', err?.message || err);
      throw new Error('Payment provider error');
    }

    if (paymentResponse.status !== 200) {
      throw new Error('Payment failed');
    }

    // Update the invoice status in the database (seguimos filtrando por userId por seguridad)
    await db('invoices')
      .where({ id: invoiceId, userId })
      .update({ status: 'paid' });
  }

  // Método que devuelve factura asegurando que pertenece al userId
  static async getInvoiceForUser(invoiceId: string, userId: string): Promise<Invoice> {
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId, userId }).first();
    if (!invoice) {
      throw new Error('Invoice not found or not accessible');
    }
    return invoice as Invoice;
  }

  // Método existente: lo dejamos pero lo marcamos como menos seguro; preferir getInvoiceForUser
  static async getInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice as Invoice;
  }

  // getReceipt ahora valida propiedad y protege contra path traversal
  static async getReceipt(invoiceId: string, pdfName: string, requestingUserId?: string) {
    // Verificar que la factura existe (y opcionalmente que pertenezca al usuario)
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (requestingUserId && invoice.userId !== requestingUserId) {
      throw new Error('Forbidden');
    }

    // Normalizar y validar nombre de archivo: usar basename para evitar subdirectorios
    const safeFileName = path.basename(pdfName);

    // Construir ruta segura y comprobar que está dentro del directorio permitido
    const safeBase = path.resolve(INVOICE_RECEIPT_DIR);
    const candidatePath = path.resolve(safeBase, safeFileName);

    if (!candidatePath.startsWith(safeBase + path.sep) && candidatePath !== safeBase) {
      // si no está dentro del directorio base, rechazar
      throw new Error('Invalid file path');
    }

    try {
      // Leer como buffer (ideal para pdfs); el caller decide cómo servirlo (stream/base64/etc.)
      const contentBuffer = await fs.readFile(candidatePath);
      return contentBuffer; // retorna Buffer
    } catch (error) {
      console.error('Error reading receipt file:', error);
      throw new Error('Receipt not found');
    }
  }
}

export default InvoiceService;