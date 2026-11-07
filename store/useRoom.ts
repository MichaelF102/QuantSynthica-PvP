'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import PartySocket from 'partysocket';
import { getClientId, loadToken, roomHost, saveToken } from '@/lib/multiplayer/client';
import type { ClientMessage } from '@/lib/multiplayer/protocol';
import type { PlayerAction } from '@/lib/multiplayer/roomTypes';
import { FATAL_TEXT, initialRoomClient, isFatalError, parseServerMessage, roomClientReducer, type RoomClientState } from '@/lib/multiplayer/roomClient';

/** The client frame for a player action. */
export function actionMessage(action: PlayerAction, seq: number): ClientMessage {
  if (action === 'close' || action === 'cancel') return { type: action, seq };
  if ('brackets' in action) return { type: 'brackets', seq, stopLoss: action.brackets.stopLoss, takeProfit: action.brackets.takeProfit };
  return { type: 'order', seq, order: action };
}

/** Close codes the room server uses (room-server/src/Room.ts). */
const CLOSE_REPLACED = 4000;
const CLOSE_GONE = 4004;

export type UseRoom = {
  state: RoomClientState;
  send: (m: ClientMessage) => void;
  leave: () => void;
  clearNotice: () => void;
  /** Sends an order, close, stop/target change or cancel with the next seq; false when not connected. */
  placeOrder: (action: PlayerAction) => boolean;
};

/**
 * One socket to room `code`, reconnecting with back-off (partysocket). Sends `hello` on every
 * (re)connect once a nickname is known, with the stored seat token so a refresh keeps the seat.
 * Fatal errors (room gone, full, seat taken, opened elsewhere) stop the reconnecting.
 */
export function useRoom(code: string, nickname: string | null): UseRoom {
  const [state, dispatch] = useReducer(roomClientReducer, initialRoomClient);
  const sock = useRef<PartySocket | null>(null);
  const nick = useRef(nickname);
  nick.current = nickname;
  const latest = useRef(state);
  latest.current = state;

  const hello = useCallback(() => {
    const s = sock.current;
    if (!s || s.readyState !== WebSocket.OPEN || !nick.current) return;
    s.send(JSON.stringify({ type: 'hello', clientId: getClientId(), nickname: nick.current, token: loadToken(code) } satisfies ClientMessage));
  }, [code]);

  useEffect(() => {
    const host = roomHost();
    if (!host) {
      dispatch({ kind: 'fatal', code: 'unavailable', message: FATAL_TEXT.unavailable });
      return;
    }
    const s = new PartySocket({ host, party: 'room', room: code, minReconnectionDelay: 1000, maxReconnectionDelay: 10_000, maxRetries: 60 });
    sock.current = s;
    s.onopen = () => {
      dispatch({ kind: 'status', status: 'open' });
      hello();
    };
    s.onclose = (e) => {
      if (e.code === CLOSE_REPLACED) {
        s.close();
        dispatch({ kind: 'fatal', code: 'replaced', message: FATAL_TEXT.replaced });
      } else if (e.code === CLOSE_GONE) {
        s.close(); // the error message that preceded it says why
      } else {
        dispatch({ kind: 'status', status: 'reconnecting' });
      }
    };
    s.onmessage = (e) => {
      const msg = parseServerMessage(e.data);
      if (!msg) return;
      if (msg.type === 'welcome') saveToken(code, msg.token);
      if (msg.type === 'error' && isFatalError(msg.code)) s.close();
      dispatch({ kind: 'msg', msg, now: Date.now() });
    };
    return () => {
      s.close();
      sock.current = null;
    };
  }, [code, hello]);

  // A nickname typed after the socket opened.
  useEffect(() => {
    if (nickname && !state.you) hello();
  }, [nickname, state.you, hello]);

  const send = useCallback((m: ClientMessage) => {
    const s = sock.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(m));
  }, []);

  const leave = useCallback(() => {
    send({ type: 'leave' });
    sock.current?.close();
  }, [send]);

  const clearNotice = useCallback(() => dispatch({ kind: 'clear_notice' }), []);

  const placeOrder = useCallback((action: PlayerAction) => {
    const s = sock.current;
    const duel = latest.current.duel;
    if (!s || s.readyState !== WebSocket.OPEN || !duel) return false;
    const seq = duel.nextSeq;
    s.send(JSON.stringify(actionMessage(action, seq)));
    dispatch({ kind: 'order_sent', seq });
    // Two clicks before a re-render must not reuse a seq.
    latest.current = { ...latest.current, duel: { ...duel, nextSeq: seq + 1 } };
    return true;
  }, []);

  return { state, send, leave, clearNotice, placeOrder };
}
