import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_DEMO_ORDERS,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TRIAL_METRICS,
} from './src/data/defaultBusinessData.ts';
import type {
  BusinessConfig,
  DailyTrialMetric,
  MenuItem,
  SubmittedOrder,
} from './src/types/business.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface PrototypeStore {
  config: BusinessConfig;
  menu: MenuItem[];
  orders: SubmittedOrder[];
  metrics: DailyTrialMetric[];
}

const store: PrototypeStore = {
  config: structuredClone(DEFAULT_BUSINESS_CONFIG),
  menu: structuredClone(DEFAULT_MENU_ITEMS),
  orders: structuredClone(DEFAULT_DEMO_ORDERS),
  metrics: structuredClone(DEFAULT_TRIAL_METRICS),
};

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'prototype',
      integrations: {
        geminiNluConfigured: hasValidGeminiKey(),
        whatsappCloudApiConfigured: false,
        googleSheetsWebhookConfigured: false,
      },
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json({
      config: store.config,
      menu: store.menu,
      orders: store.orders,
      metrics: store.metrics,
      integrations: {
        geminiNluConfigured: hasValidGeminiKey(),
        whatsappCloudApiConfigured: false,
        googleSheetsWebhookConfigured: false,
      },
    });
  });

  app.post('/api/orders', (req, res) => {
    const incoming = req.body as SubmittedOrder;
    if (!incoming || !incoming.orderId) {
      res.status(400).json({ error: 'Invalid order payload' });
      return;
    }
    const sanitizedOrder: SubmittedOrder = {
      ...incoming,
      // Enforce human review status on creation; never auto-confirm
      status: 'Submitted for review',
    };
    store.orders = [sanitizedOrder, ...store.orders.filter((o) => o.orderId !== sanitizedOrder.orderId)];
    res.status(201).json({ order: sanitizedOrder });
  });

  app.patch('/api/orders/:orderId', (req, res) => {
    const { orderId } = req.params;
    const { status, teamDecision, teamNotes, reviewedBy } = req.body as Partial<SubmittedOrder>;
    const idx = store.orders.findIndex((o) => o.orderId === orderId);
    if (idx === -1) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const existing = store.orders[idx];
    const updated: SubmittedOrder = {
      ...existing,
      status: status ?? existing.status,
      teamDecision: teamDecision !== undefined ? teamDecision : existing.teamDecision,
      teamNotes: teamNotes !== undefined ? teamNotes : existing.teamNotes,
      reviewedBy: reviewedBy !== undefined ? reviewedBy : existing.reviewedBy,
    };
    store.orders[idx] = updated;
    res.json({ order: updated });
  });

  app.put('/api/config', (req, res) => {
    const { config, menu } = req.body as { config?: BusinessConfig; menu?: MenuItem[] };
    if (!config || !Array.isArray(menu)) {
      res.status(400).json({ error: 'Config and menu arrays are required' });
      return;
    }
    store.config = config;
    store.menu = menu;
    res.json({ config: store.config, menu: store.menu });
  });

  app.put('/api/metrics', (req, res) => {
    const { metrics } = req.body as { metrics?: DailyTrialMetric[] };
    if (!Array.isArray(metrics)) {
      res.status(400).json({ error: 'Metrics array is required' });
      return;
    }
    store.metrics = metrics;
    res.json({ metrics: store.metrics });
  });

  // Optional server-side Gemini NLU entity extraction when GEMINI_API_KEY is configured
  app.post('/api/nlu-extract', async (req, res) => {
    if (!hasValidGeminiKey()) {
      res.json({ available: false, extracted: null });
      return;
    }

    const { message } = req.body as { message?: string };
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message text is required' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract structured Kerala snack order fields from this customer message (Malayalam, Manglish, or English). Never invent prices or confirm orders.\nMessage: "${message}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              customerName: { type: Type.STRING },
              contact: { type: Type.STRING },
              requestedDateTime: { type: Type.STRING },
              fulfillment: { type: Type.STRING },
              deliveryAddress: { type: Type.STRING },
              landmark: { type: Type.STRING },
              isBulkEvent: { type: Type.BOOLEAN },
            },
          },
        },
      });

      const text = (response.text ?? '{}').trim();
      res.json({ available: true, extracted: JSON.parse(text) });
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Gemini NLU request failed';
      res.status(502).json({ error: errMessage });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Panankayam Homemade Snacks prototype listening on http://localhost:${PORT}`);
  });
}

startServer();
