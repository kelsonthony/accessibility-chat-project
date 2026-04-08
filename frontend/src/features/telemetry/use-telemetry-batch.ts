'use client';

import { useEffect, useRef } from 'react';

import type { SupportedLanguage, TelemetryEventInput, TelemetryEventType } from '@accessibility-platform/contracts';

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_SIZE = 20;

type Options = {
  token: string | null;
  sessionId: string;
  language: SupportedLanguage;
};

export function useTelemetryBatch({ token, sessionId, language }: Options) {
  const queueRef = useRef<TelemetryEventInput[]>([]);
  const tokenRef = useRef<string | null>(token);
  const metricsRef = useRef({
    queued: 0,
    lastFlushAt: '',
    lastFlushCount: 0,
    lastFlushStatus: 'idle' as 'idle' | 'success' | 'failed',
  });

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void flush('timer');
    }, FLUSH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flush('visibility');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function flush(trigger: 'timer' | 'size' | 'visibility') {
    if (!tokenRef.current || queueRef.current.length === 0) {
      return;
    }

    const events = [...queueRef.current];
    queueRef.current = [];

    try {
      await fetch(`${getApiBaseUrl()}/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ events }),
        keepalive: trigger === 'visibility',
      });
      metricsRef.current = {
        queued: queueRef.current.length,
        lastFlushAt: new Date().toISOString(),
        lastFlushCount: events.length,
        lastFlushStatus: 'success',
      };
    } catch {
      queueRef.current.unshift(...events);
      metricsRef.current = {
        queued: queueRef.current.length,
        lastFlushAt: new Date().toISOString(),
        lastFlushCount: events.length,
        lastFlushStatus: 'failed',
      };
    }
  }

  function track(eventType: TelemetryEventType, metadata: Record<string, string | number | boolean | null>) {
    queueRef.current.push({
      sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        language,
      },
    });
    metricsRef.current.queued = queueRef.current.length;

    if (queueRef.current.length >= FLUSH_SIZE) {
      void flush('size');
    }
  }

  function getMetrics() {
    return { ...metricsRef.current, queued: queueRef.current.length };
  }

  return { track, flush, getMetrics };
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
}
