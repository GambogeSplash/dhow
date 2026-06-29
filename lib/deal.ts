/*
 * Dhow deal lifecycle — the shared object both sides of the marketplace act on.
 *
 * A deal is the working-capital negotiation between an importer (the borrower)
 * and a financier: the request, the offers and counters, the agreement, the
 * disbursement, and the repayment. One object, two parties, one timeline — so a
 * thing the importer does (request, counter, accept, repay) is the same thing
 * the financier sees, and vice-versa. This fixes the old split where "accept"
 * and "fund" lived on two disconnected screens.
 *
 * Pure and chain-agnostic. The on-chain transfer swaps in at the edges (txHash);
 * everything here is deterministic so the client and server agree.
 */

import { AED_PER_USD } from "./credit";

// ---- status & parties ----

export type DealStatus =
  | "requested" // borrower asked for capital; the financier's move
  | "offered" // financier proposed terms; the borrower's move
  | "countered" // one side countered the terms; the other side's move
  | "agreed" // terms locked; the financier disburses next
  | "funded" // money sent; repayment outstanding
  | "repaid" // closed clean
  | "declined" // a party walked away
  | "withdrawn"; // the borrower pulled the request

/** Statuses where the deal is still being negotiated (terms can change). */
export const OPEN_STATUSES: DealStatus[] = ["requested", "offered", "countered"];
/** Statuses where the deal is live capital (funded, not yet repaid). */
export const ACTIVE_STATUSES: DealStatus[] = ["agreed", "funded"];
/** Statuses where the deal is over. */
export const CLOSED_STATUSES: DealStatus[] = ["repaid", "declined", "withdrawn"];

export type DealParty = "borrower" | "financier";

export type DealEventKind =
  | "requested"
  | "offered"
  | "countered"
  | "agreed"
  | "funded"
  | "repaid"
  | "declined"
  | "withdrawn"
  | "message";

// ---- terms ----

export interface DealTerms {
  amountAed: number; // principal advance
  ratePct: number; // financing fee, flat on draw (e.g. 1.5 = 1.5%)
  tenorDays: number; // repayment window in days
}

export const DEFAULT_RATE_PCT = 1.5;
export const DEFAULT_TENOR_DAYS = 30;
export const TENOR_OPTIONS = [30, 45, 60, 90];
export const MIN_RATE_PCT = 0.5;
export const MAX_RATE_PCT = 6;
export const MIN_TENOR_DAYS = 7;
export const MAX_TENOR_DAYS = 120;

/** The flat financing fee in AED. */
export function feeAed(t: DealTerms): number {
  return Math.round(t.amountAed * (t.ratePct / 100));
}
/** Total the borrower repays: principal + fee. */
export function totalRepayableAed(t: DealTerms): number {
  return Math.round(t.amountAed + feeAed(t));
}
/** AED → USDC at the fixed CBUAE peg, 2dp. */
export function dealUsdc(aed: number): number {
  return Math.round((aed / AED_PER_USD) * 100) / 100;
}
/** Repayment due timestamp (ms epoch) from a funding time + tenor. */
export function dueAt(fundedAt: number, tenorDays: number): number {
  return fundedAt + tenorDays * 86_400_000;
}
/** Whole days until (or, negative, past) the due date. */
export function daysUntil(due: number, now: number): number {
  return Math.ceil((due - now) / 86_400_000);
}
export function termsEqual(a: DealTerms, b: DealTerms): boolean {
  return a.amountAed === b.amountAed && a.ratePct === b.ratePct && a.tenorDays === b.tenorDays;
}
export function clampTerms(t: DealTerms): DealTerms {
  return {
    amountAed: Math.max(0, Math.round(t.amountAed)),
    ratePct: Math.min(MAX_RATE_PCT, Math.max(MIN_RATE_PCT, Math.round(t.ratePct * 100) / 100)),
    tenorDays: Math.min(MAX_TENOR_DAYS, Math.max(MIN_TENOR_DAYS, Math.round(t.tenorDays))),
  };
}

// ---- the deal ----

export interface DealEvent {
  id: string;
  actor: DealParty | "system";
  kind: DealEventKind;
  terms?: DealTerms; // terms proposed at this step (request/offer/counter)
  note?: string; // purpose, message, or decline reason
  createdAt: number;
}

export interface Deal {
  id: string;
  borrowerId: string;
  borrowerName: string;
  financierId: string | null;
  financierName: string | null;
  status: DealStatus;
  turn: DealParty; // whose move it is (meaningless once closed)
  terms: DealTerms; // the live terms on the table
  purpose?: string;
  requestId?: string; // set on a competing offer: the borrower request it answers
  financierWallet?: string; // the address that funded — where repayment is sent
  fundedAt?: number;
  txHash?: string;
  explorerUrl?: string;
  dueAt?: number;
  repaidAt?: number;
  repayTxHash?: string;
  repayExplorerUrl?: string;
  createdAt: number;
  updatedAt: number;
  events: DealEvent[];
}

// ---- permissions (what each side may do right now) ----

export interface DealPermissions {
  canOffer: boolean; // financier proposes first terms on a bare request
  canCounter: boolean; // propose different terms, ball passes to the other side
  canAccept: boolean; // accept the terms on the table → agreed
  canDecline: boolean; // walk away
  canWithdraw: boolean; // borrower pulls the request
  canFund: boolean; // financier disburses an agreed deal
  canRepay: boolean; // borrower repays a funded deal
}

const NONE: DealPermissions = {
  canOffer: false,
  canCounter: false,
  canAccept: false,
  canDecline: false,
  canWithdraw: false,
  canFund: false,
  canRepay: false,
};

/** What `party` can do on `deal` right now. Drives both UI gating and the API. */
export function permissions(deal: Deal, party: DealParty): DealPermissions {
  const mine = deal.turn === party;
  switch (deal.status) {
    case "requested":
      // Borrower waits; the financier's first move is an offer (which claims the
      // deal) or a decline. Not a counter — there is no offer to counter yet, and
      // a counter would not record the financier on the deal.
      return party === "financier"
        ? { ...NONE, canOffer: true, canDecline: true }
        : { ...NONE, canWithdraw: true };
    case "offered":
    case "countered":
      // Whoever's turn it is may accept, counter, or decline. The borrower may
      // also withdraw the whole request at any open stage.
      return {
        ...NONE,
        canAccept: mine,
        canCounter: mine,
        canDecline: mine,
        canWithdraw: party === "borrower",
      };
    case "agreed":
      // Terms locked. Financier disburses; either side can still back out first.
      return party === "financier"
        ? { ...NONE, canFund: true, canDecline: true }
        : { ...NONE, canWithdraw: true };
    case "funded":
      // Borrower repays. (Auto-repayment from the next settlement also lands here.)
      return party === "borrower" ? { ...NONE, canRepay: true } : NONE;
    default:
      return NONE;
  }
}

// ---- actions (the reducer the API applies; pure) ----

export type DealAction =
  | { kind: "offer"; by: "financier"; financierId: string; financierName: string; terms: DealTerms; note?: string }
  | { kind: "counter"; by: DealParty; terms: DealTerms; note?: string }
  | { kind: "accept"; by: DealParty }
  | { kind: "decline"; by: DealParty; note?: string }
  | { kind: "withdraw"; by: "borrower" }
  | { kind: "fund"; by: "financier"; txHash?: string; explorerUrl?: string; financierWallet?: string }
  | { kind: "repay"; by: "borrower"; txHash?: string; explorerUrl?: string };

export class DealError extends Error {}

function event(actor: DealParty | "system", kind: DealEventKind, now: number, terms?: DealTerms, note?: string): DealEvent {
  return { id: eventId(), actor, kind, terms, note, createdAt: now };
}

/**
 * Apply an action to a deal, returning the next deal. Pure: validates the
 * transition against `permissions`, flips the turn, and appends the timeline
 * event. Throws `DealError` on an illegal move so the API can answer 409.
 */
export function applyAction(deal: Deal, action: DealAction, now: number): Deal {
  const perms = permissions(deal, action.by);
  const next: Deal = { ...deal, events: [...deal.events], updatedAt: now };

  switch (action.kind) {
    case "offer": {
      if (!perms.canOffer) throw new DealError("Cannot offer on this deal now.");
      next.financierId = action.financierId;
      next.financierName = action.financierName;
      next.terms = clampTerms(action.terms);
      next.status = "offered";
      next.turn = "borrower";
      next.events.push(event("financier", "offered", now, next.terms, action.note));
      return next;
    }
    case "counter": {
      if (!perms.canCounter) throw new DealError("It is not your turn to counter.");
      next.terms = clampTerms(action.terms);
      next.status = "countered";
      next.turn = action.by === "borrower" ? "financier" : "borrower";
      next.events.push(event(action.by, "countered", now, next.terms, action.note));
      return next;
    }
    case "accept": {
      if (!perms.canAccept) throw new DealError("It is not your turn to accept.");
      next.status = "agreed";
      next.turn = "financier"; // financier disburses next
      next.events.push(event(action.by, "agreed", now, next.terms));
      return next;
    }
    case "decline": {
      if (!perms.canDecline) throw new DealError("You cannot decline this deal now.");
      next.status = "declined";
      next.events.push(event(action.by, "declined", now, undefined, action.note));
      return next;
    }
    case "withdraw": {
      if (!perms.canWithdraw) throw new DealError("You cannot withdraw this deal now.");
      next.status = "withdrawn";
      next.events.push(event("borrower", "withdrawn", now));
      return next;
    }
    case "fund": {
      if (!perms.canFund) throw new DealError("This deal is not agreed and ready to fund.");
      next.status = "funded";
      next.turn = "borrower";
      next.fundedAt = now;
      next.txHash = action.txHash;
      next.explorerUrl = action.explorerUrl;
      next.financierWallet = action.financierWallet;
      next.dueAt = dueAt(now, next.terms.tenorDays);
      next.events.push(event("financier", "funded", now, next.terms));
      return next;
    }
    case "repay": {
      if (!perms.canRepay) throw new DealError("This deal is not funded.");
      next.status = "repaid";
      next.repaidAt = now;
      next.repayTxHash = action.txHash;
      next.repayExplorerUrl = action.explorerUrl;
      next.events.push(event("borrower", "repaid", now, next.terms));
      return next;
    }
  }
}

/** Build a brand-new deal opened by the borrower's request. */
export function openRequest(args: {
  id: string;
  borrowerId: string;
  borrowerName: string;
  terms: DealTerms;
  purpose?: string;
  now: number;
}): Deal {
  const terms = clampTerms(args.terms);
  return {
    id: args.id,
    borrowerId: args.borrowerId,
    borrowerName: args.borrowerName,
    financierId: null,
    financierName: null,
    status: "requested",
    turn: "financier",
    terms,
    purpose: args.purpose,
    createdAt: args.now,
    updatedAt: args.now,
    events: [event("borrower", "requested", args.now, terms, args.purpose)],
  };
}

/** A financier's competing offer against an open borrower request. The request
 *  stays open so other financiers can also bid; this offer is a sibling the
 *  borrower can accept (which closes the request and the other bids). */
export function offerOnRequest(args: {
  id: string;
  request: Deal;
  financierId: string;
  financierName: string;
  terms: DealTerms;
  note?: string;
  now: number;
}): Deal {
  const terms = clampTerms(args.terms);
  return {
    id: args.id,
    borrowerId: args.request.borrowerId,
    borrowerName: args.request.borrowerName,
    financierId: args.financierId,
    financierName: args.financierName,
    status: "offered",
    turn: "borrower",
    terms,
    purpose: args.request.purpose,
    requestId: args.request.id,
    createdAt: args.now,
    updatedAt: args.now,
    events: [
      { id: eventId(), actor: "borrower", kind: "requested", terms: args.request.terms, note: args.request.purpose, createdAt: args.request.createdAt },
      { id: eventId(), actor: "financier", kind: "offered", terms, note: args.note, createdAt: args.now },
    ],
  };
}

/** Build a deal a financier opens proactively (already an offer; borrower's move). */
export function openOffer(args: {
  id: string;
  borrowerId: string;
  borrowerName: string;
  financierId: string;
  financierName: string;
  terms: DealTerms;
  note?: string;
  now: number;
}): Deal {
  const terms = clampTerms(args.terms);
  return {
    id: args.id,
    borrowerId: args.borrowerId,
    borrowerName: args.borrowerName,
    financierId: args.financierId,
    financierName: args.financierName,
    status: "offered",
    turn: "borrower",
    terms,
    createdAt: args.now,
    updatedAt: args.now,
    events: [event("financier", "offered", args.now, terms, args.note)],
  };
}

// ---- a short, human label for the current state, from a party's view ----

export function statusLabel(deal: Deal, viewer: DealParty): string {
  switch (deal.status) {
    case "requested":
      return viewer === "borrower" ? "Awaiting an offer" : "New request";
    case "offered":
      return deal.turn === viewer ? "Offer to review" : "Offer sent";
    case "countered":
      return deal.turn === viewer ? "Counter to review" : "Counter sent";
    case "agreed":
      return viewer === "financier" ? "Ready to fund" : "Agreed — awaiting funds";
    case "funded":
      return "Funded";
    case "repaid":
      return "Repaid";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "Withdrawn";
  }
}

function eventId(): string {
  try {
    return `ev_${crypto.randomUUID().slice(0, 12)}`;
  } catch {
    return `ev_${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function newDealId(): string {
  try {
    return `deal_${crypto.randomUUID().slice(0, 12)}`;
  } catch {
    return `deal_${Math.random().toString(36).slice(2, 14)}`;
  }
}
