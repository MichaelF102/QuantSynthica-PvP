import { Server, type Connection } from 'partyserver';
import { fetchText, parseCandlesCsv, pickRandomSession } from '../../lib/data';
import { rehydrate, dehydrate, takeToken, type Bucket } from '../../lib/multiplayer/persist';
import { encode, parseClientMessage, type ServerMessage } from '../../lib/multiplayer/protocol';
import { createRoom, errorMsg, nextWakeAt, roomReducer, type Reduced, type RoomEffect, type RoomEvent, type RoomState } from '../../lib/multiplayer/room';
import { roomMessage } from '../../lib/multiplayer/roomMatch';
import { roomSessionSpec, roomSymbol, type RoomSettings } from '../../lib/multiplayer/settings';
import type { Candle, Session, SymbolInfo } from '../../lib/types';

// One Durable Object per room. A thin shell around the pure reducer (lib/multiplayer/room.ts):
// it turns socket frames into events, delivers the reducer's effects, keeps the clock with
// setTimeout (plus a storage alarm as a backstop if the object is evicted), and persists state.

type ConnState = { clientId?: string };

/** During a match, state is saved at most this often on plain clock ticks (orders save at once). */
const TICK_SAVE_MS = 5_000;
/** Alarm set this far ahead while timers run, so an evicted room resumes within ~10 s. */
const BACKSTOP_MS = 10_000;
const CLOSE_REPLACED = 4000;
const CLOSE_GONE = 4004;

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export type RoomPeek = { phase: RoomState['phase']; players: number; settings: RoomSettings } | null;

export class Room extends Server<Env> {
  static options = { hibernate: true };

  private room: RoomState | null = null;
  private info: SymbolInfo | null = null;
  private candles: Candle[] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private alarmAt: number | null = null;
  private lastSave = 0;
  private buckets = new Map<string, Bucket>();

  async onStart() {
    const [room, info, count] = await Promise.all([this.ctx.storage.get<RoomState>('room'), this.ctx.storage.get<SymbolInfo>('info'), this.ctx.storage.get<number>('chunks')]);
    if (!room || !info) return;
    const keys = Array.from({ length: count ?? 0 }, (_, i) => `c:${i}`);
    const stored = keys.length ? await this.ctx.storage.get<Candle[]>(keys) : new Map<string, Candle[]>();
    this.room = rehydrate(room, keys.map((k) => stored.get(k) ?? []));
    this.info = info;
    this.alarmAt = await this.ctx.storage.getAlarm();
    // Sockets survive hibernation but not a restart or eviction, and a lost socket sends no
    // close event. A seated player with no live socket is treated as disconnected (grace starts).
    for (const p of this.room.players) {
      if (p.connected && this.socketsFor(p.id).length === 0) this.dispatch({ type: 'disconnect', playerId: p.id });
    }
    this.schedule();
  }

  // ---------- RPC from the Worker entry ----------

  async create(settings: RoomSettings, info: SymbolInfo): Promise<'ok' | 'taken'> {
    if (this.room && this.room.phase !== 'expired') return 'taken';
    const session = await this.loadSession(info, settings);
    this.info = info;
    this.room = createRoom({ code: this.name, settings, symbol: roomSymbol(info), session, now: Date.now() });
    await this.ctx.storage.put('info', info);
    this.save(true);
    this.schedule();
    return 'ok';
  }

  peek(): RoomPeek {
    return this.room && this.room.phase !== 'expired' ? { phase: this.room.phase, players: this.room.players.length, settings: this.room.settings } : null;
  }

  // ---------- Sockets ----------

  onConnect(conn: Connection<ConnState>) {
    if (!this.room || this.room.phase === 'expired') {
      conn.send(encode(errorMsg(this.room ? 'expired' : 'not_found')));
      conn.close(CLOSE_GONE, 'Room not available');
      return;
    }
    conn.send(encode(roomMessage(this.room, Date.now())));
  }

  onMessage(conn: Connection<ConnState>, raw: string | ArrayBuffer | ArrayBufferView) {
    const now = Date.now();
    const { ok, bucket } = takeToken(this.buckets.get(conn.id), now);
    this.buckets.set(conn.id, bucket);
    if (!ok) return conn.send(encode(errorMsg('rate_limited')));

    const msg = parseClientMessage(raw);
    if (!msg) return conn.send(encode(errorMsg('bad_message')));
    if (msg.type === 'ping') return conn.send(encode({ type: 'pong', serverNow: now }));
    if (msg.type === 'hello') return this.dispatch({ type: 'hello', clientId: msg.clientId, nickname: msg.nickname, token: msg.token, newToken: newToken() }, conn);

    const playerId = conn.state?.clientId;
    if (!playerId) return conn.send(encode(errorMsg('not_joined')));
    switch (msg.type) {
      case 'order':
        return this.dispatch({ type: 'order', playerId, seq: msg.seq, order: msg.order });
      case 'close':
        return this.dispatch({ type: 'close', playerId, seq: msg.seq });
      case 'cancel':
        return this.dispatch({ type: 'cancel', playerId, seq: msg.seq });
      case 'brackets':
        return this.dispatch({ type: 'brackets', playerId, seq: msg.seq, brackets: { stopLoss: msg.stopLoss, takeProfit: msg.takeProfit } });
      case 'leave':
        this.dispatch({ type: 'leave', playerId });
        conn.setState({});
        return;
      default:
        return this.dispatch({ type: msg.type, playerId });
    }
  }

  onClose(conn: Connection<ConnState>) {
    this.buckets.delete(conn.id);
    const id = conn.state?.clientId;
    // A refresh can open the new socket before the old one closes; only the last socket counts.
    if (!id || this.socketsFor(id).some((c) => c.id !== conn.id)) return;
    this.dispatch({ type: 'disconnect', playerId: id });
  }

  async onAlarm() {
    this.alarmAt = null;
    this.dispatch({ type: 'tick' });
  }

  // ---------- Reducer plumbing ----------

  private socketsFor(clientId: string): Connection<ConnState>[] {
    return [...this.getConnections<ConnState>()].filter((c) => c.state?.clientId === clientId);
  }

  private dispatch(e: RoomEvent, origin?: Connection<ConnState>) {
    if (!this.room) return;
    const now = Date.now();
    const before = this.room.phase;
    const r: Reduced = roomReducer(this.room, e, now);
    this.room = r.state;
    // A hello that wins the seat binds the socket; one that does not (room full, wrong token)
    // gets its replies on its own socket only, never on the seat holder's.
    const seated = e.type === 'hello' && origin ? this.bind(e.clientId, origin, r) : true;
    const pending = e.type === 'hello' && origin && !seated ? { clientId: e.clientId, conn: origin } : null;
    for (const eff of r.effects) this.apply(eff, pending);
    if (!this.room) return; // shut down by an effect
    const urgent = e.type !== 'tick' || r.state.phase !== before;
    if (urgent || now - this.lastSave >= TICK_SAVE_MS) this.save(e.type === 'restart');
    this.schedule();
  }

  /** A successful hello binds the socket to the seat and closes any older socket for it. */
  private bind(clientId: string, conn: Connection<ConnState>, r: Reduced): boolean {
    const welcomed = r.effects.some((x) => x.kind === 'send' && x.to === clientId && x.msg.type === 'welcome');
    if (!welcomed) return false;
    for (const old of this.socketsFor(clientId)) {
      if (old.id === conn.id) continue;
      old.setState({});
      old.close(CLOSE_REPLACED, 'Opened in another tab');
    }
    conn.setState({ clientId });
    return true;
  }

  private sendTo(to: string, msg: ServerMessage, pending: { clientId: string; conn: Connection } | null) {
    const frame = encode(msg);
    if (pending && pending.clientId === to) return pending.conn.send(frame);
    const targets = to === '*' ? [...this.getConnections<ConnState>()].filter((c) => c.state?.clientId) : this.socketsFor(to);
    for (const c of targets) c.send(frame);
  }

  private apply(eff: RoomEffect, pending: { clientId: string; conn: Connection } | null) {
    if (eff.kind === 'send') return this.sendTo(eff.to, eff.msg, pending);
    if (eff.kind === 'new_session') return void this.rematchSession();
    if (eff.kind === 'shutdown') return void this.shutdown();
  }

  private async rematchSession() {
    if (!this.room || !this.info) return;
    let session: Session;
    try {
      session = await this.loadSession(this.info, this.room.settings);
    } catch (err) {
      console.error('rematch session failed', err);
      this.sendTo('*', errorMsg('data_unavailable'), null);
      return;
    }
    this.dispatch({ type: 'restart', session });
  }

  private async shutdown() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const c of this.getConnections()) c.close(CLOSE_GONE, 'Room expired');
    this.room = null;
    this.candles = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.alarmAt = null;
  }

  private async loadSession(info: SymbolInfo, settings: RoomSettings): Promise<Session> {
    if (!this.candles) this.candles = parseCandlesCsv(await fetchText(`${this.env.DATA_ORIGIN.replace(/\/$/, '')}/data/${info.dataFile}`, { retries: 2 }));
    return pickRandomSession(this.candles, roomSessionSpec(settings));
  }

  /** Candles are written only with `full` (create and rematch); other saves store the light state. */
  private save(full: boolean) {
    if (!this.room) return;
    const { room, chunks } = dehydrate(this.room);
    const entries: Record<string, unknown> = { room };
    if (full) {
      entries.chunks = chunks.length;
      chunks.forEach((c, i) => (entries[`c:${i}`] = c));
    }
    void this.ctx.storage.put(entries);
    this.lastSave = Date.now();
  }

  /** setTimeout for the next wake-up; a storage alarm as a backstop (or for long waits). */
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const next = this.room ? nextWakeAt(this.room) : null;
    if (next === null) {
      if (this.alarmAt !== null) void this.ctx.storage.deleteAlarm();
      this.alarmAt = null;
      return;
    }
    const now = Date.now();
    const delay = Math.max(0, next - now);
    const short = delay <= 60_000;
    if (short) this.timer = setTimeout(() => ((this.timer = null), this.dispatch({ type: 'tick' })), delay);
    const want = short ? Math.max(next, now + BACKSTOP_MS) : next;
    if (this.alarmAt === null || Math.abs(this.alarmAt - want) > BACKSTOP_MS / 2) {
      this.alarmAt = want;
      void this.ctx.storage.setAlarm(want);
    }
  }
}
