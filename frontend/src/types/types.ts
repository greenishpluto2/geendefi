// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
export type ApiLockedObject = {
  id?: string;
  objectId: string;
  keyId: string;
  creator?: string;
  itemId: string;
  deleted: boolean;
};

export type ApiEscrowObject = {
  id: string;
  objectId: string;
  sender: string;
  recipient: string;
  keyId: string;
  itemId: string;
  swapped: boolean;
  cancelled: boolean;
  isHashlock?: boolean;
  hashCommitment?: string;
  timeoutMs?: string;
  secretRevealed?: string;
};

export type EscrowListingQuery = {
  escrowId?: string;
  sender?: string;
  recipient?: string;
  cancelled?: string;
  swapped?: string;
  isHashlock?: string;
  limit?: string;
};

export type HashlockEscrowParams = {
  objectId: string;
  objectType: string;
  exchangeKeyId: string;
  recipient: string;
  secret: string;
  timeoutMs: number;
};

export type RevealSecretParams = {
  escrowId: string;
  secret: string;
  lockedObjectId: string;
  keyId: string;
};

export type LockedListingQuery = {
  deleted?: string;
  keyId?: string;
  limit?: string;
};
