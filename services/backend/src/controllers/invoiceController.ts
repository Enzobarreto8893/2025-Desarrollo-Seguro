import { Request, Response, NextFunction } from 'express';
import InvoiceService from '../services/invoiceService';

const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const operator = req.query.operator as string | undefined;
    const userId = (req as any).user!.id;

    const invoices = await InvoiceService.list(userId, status, operator);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
};

const setPaymentCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    const { paymentBrand, ccNumber, ccv, expirationDate } = req.body;
    const userId = (req as any).user!.id;

    if (!paymentBrand || !ccNumber || !ccv || !expirationDate) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    await InvoiceService.setPaymentCard(userId, invoiceId, paymentBrand, ccNumber, ccv, expirationDate);
    res.status(200).json({ message: 'Payment successful' });
  } catch (err) {
    next(err);
  }
};

const getInvoicePDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    const pdfName = req.query.pdfName as string | undefined;
    const userId = (req as any).user!.id;

    if (!pdfName) {
      return res.status(400).json({ error: 'Missing parameter pdfName' });
    }

    // Ahora usamos getReceipt validando la propiedad del usuario
    const pdfBuffer = await InvoiceService.getReceipt(invoiceId, pdfName, userId);

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = req.params.id;
    const userId = (req as any).user!.id;

    // Usamos getInvoiceForUser para asegurar que solo devuelve facturas del usuario
    const invoice = await InvoiceService.getInvoiceForUser(invoiceId, userId);
    res.status(200).json(invoice);
  } catch (err) {
    next(err);
  }
};

export default {
  listInvoices,
  setPaymentCard,
  getInvoice,
  getInvoicePDF
};