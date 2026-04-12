'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { AskQuestionInput, AskQuestionResponse } from '@accessibility-platform/contracts';

type SocketMessage =
  | { event: 'chat:answer'; data: AskQuestionResponse }
  | { event: 'chat:error'; data: { message: string } };

type PendingResolve = {
  resolve: (value: AskQuestionResponse) => void;
  reject: (reason: Error) => void;
};

function getWsBaseUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  return apiBase.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

export function useChatSocket(token: string | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<PendingResolve | null>(null);
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    const url = `${getWsBaseUrl()}/chat?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as SocketMessage;

        if (msg.event === 'chat:answer') {
          pendingRef.current?.resolve(msg.data);
          pendingRef.current = null;
        } else if (msg.event === 'chat:error') {
          pendingRef.current?.reject(new Error(msg.data.message));
          pendingRef.current = null;
        }
      } catch {
        pendingRef.current?.reject(new Error('Invalid response from server'));
        pendingRef.current = null;
      }
    };

    ws.onerror = () => {
      pendingRef.current?.reject(new Error('WebSocket connection error'));
      pendingRef.current = null;
    };

    ws.onclose = (e) => {
      if (e.code === 4001) {
        pendingRef.current?.reject(new Error('Unauthorized'));
        pendingRef.current = null;
      }
      socketRef.current = null;
    };

    socketRef.current = ws;

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [token]);

  const ask = useCallback((input: AskQuestionInput): Promise<AskQuestionResponse> => {
    return new Promise((resolve, reject) => {
      const ws = socketRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      if (pendingRef.current) {
        reject(new Error('Request already in progress'));
        return;
      }

      pendingRef.current = { resolve, reject };
      ws.send(JSON.stringify({ event: 'chat:ask', data: input }));
    });
  }, []);

  return { ask };
}
