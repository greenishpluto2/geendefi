// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { CONSTANTS, QueryKey } from "@/constants";
import { useTransactionExecution } from "@/hooks/useTransactionExecution";
import { ApiEscrowObject, ApiLockedObject, HashlockEscrowParams, RevealSecretParams } from "@/types/types";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { SuiObjectData } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { keccak256 } from 'js-sha3';
import sha256 from 'js-sha256';



/**
 * Builds and executes the PTB to create a hashlock escrow.
 */
export function useCreateHashlockEscrowMutation() {
  const currentAccount = useCurrentAccount();
  const executeTransaction = useTransactionExecution();

  return useMutation({
    mutationFn: async ({
      object,
      locked,
      secret,
      timeoutHours,
    }: {
      object: SuiObjectData;
      locked: ApiLockedObject;
      secret: string;
      timeoutHours: number;
    }) => {
      console.log("Starting create hashlock escrow mutation:", { object, locked, secret, timeoutHours });
      
      if (!currentAccount?.address)
        throw new Error("You need to connect your wallet!");

      if (!secret || secret.length < 8)
        throw new Error("Secret must be at least 8 characters long!");

      // Convert secret to hash commitment using keccak256 (same as Move contract)
      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      const hashHex = keccak256(secretBytes);
      
      // Convert hex string to byte array without using Buffer
      const hashArray = [];
      for (let i = 0; i < hashHex.length; i += 2) {
        hashArray.push(parseInt(hashHex.substr(i, 2), 16));
      }

      console.log("Hash commitment:", { secret, hashHex, hashArray });

      const timeoutMs = timeoutHours * 60 * 60 * 1000; // Convert hours to milliseconds

      const txb = new Transaction();
      txb.moveCall({
        target: `${CONSTANTS.escrowContract.packageId}::hashlock_shared::create_hashlock_escrow_with_duration`,
        arguments: [
          txb.object(object.objectId!),
          txb.pure.id(locked.keyId),
          txb.pure.address(locked.creator!),
          txb.pure.vector('u8', hashArray),
          txb.pure.u64(timeoutMs),
          txb.object('0x6'), // Clock object
        ],
        typeArguments: [object.type!],
      });

      console.log("Executing create hashlock escrow transaction...");
      return executeTransaction(txb);
    },
    onSuccess: (data) => {
      console.log("Create hashlock escrow mutation succeeded:", data);
    },
    onError: (error) => {
      console.error("Create hashlock escrow mutation failed:", error);
    },
  });
}

/**
 * Builds and executes the PTB to reveal secret and complete hashlock swap.
 */
export function useRevealSecretMutation() {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const executeTransaction = useTransactionExecution();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      escrow,
      locked,
      secret,
    }: {
      escrow: ApiEscrowObject;
      locked: ApiLockedObject;
      secret: string;
    }) => {
      console.log("Starting reveal secret mutation:", { escrow, locked, secret });
      console.log("Stored hash commitment:", escrow.hashCommitment);
      
      if (!currentAccount?.address)
        throw new Error("You need to connect your wallet!");

      if (!secret)
        throw new Error("Secret is required!");

      if (!escrow.hashCommitment) {
        throw new Error("Escrow does not have a hash commitment!");
      }

      // Try both SHA-256 and keccak256 to see which matches
      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      
      // Calculate SHA-256 hash
      const sha256Buffer = await crypto.subtle.digest('SHA-256', secretBytes);
      const sha256Array = Array.from(new Uint8Array(sha256Buffer));
      const sha256Hex = sha256Array.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Calculate keccak256 hash
      const keccak256Hex = keccak256(secretBytes);

      console.log("Hash comparison:", { 
        storedHash: escrow.hashCommitment,
        sha256Hash: sha256Hex,
        keccak256Hash: keccak256Hex,
        sha256Matches: sha256Hex === escrow.hashCommitment,
        keccak256Matches: keccak256Hex === escrow.hashCommitment
      });

      // Use the hash that matches
      let hashHex;
      if (sha256Hex === escrow.hashCommitment) {
        hashHex = sha256Hex;
        console.log("Using SHA-256 hash");
      } else if (keccak256Hex === escrow.hashCommitment) {
        hashHex = keccak256Hex;
        console.log("Using keccak256 hash");
      } else {
        throw new Error(`Invalid secret! Neither SHA-256 nor keccak256 hash matches the stored commitment.`);
      }

      // Get the actual types of the objects
      console.log("Fetching object types for:", [escrow.itemId, locked.itemId]);
      
      const escrowObject = await client.multiGetObjects({
        ids: [escrow.itemId, locked.itemId],
        options: {
          showType: true,
        },
      });

      const escrowType = escrowObject.find(
        (x) => x.data?.objectId === escrow.itemId,
      )?.data?.type;

      const lockedType = escrowObject.find(
        (x) => x.data?.objectId === locked.itemId,
      )?.data?.type;

      console.log("Resolved types:", { escrowType, lockedType });

      if (!escrowType || !lockedType) {
        throw new Error("Failed to fetch object types.");
      }

      const secretArray = Array.from(secretBytes);

      console.log("Building transaction with:", {
        target: `${CONSTANTS.escrowContract.packageId}::hashlock_shared::swap_with_secret`,
        arguments: [escrow.objectId, escrow.keyId, locked.objectId, secretArray.length],
        typeArguments: [escrowType, lockedType]
      });

      const txb = new Transaction();
      const result = txb.moveCall({
        target: `${CONSTANTS.escrowContract.packageId}::hashlock_shared::swap_with_secret`,
        arguments: [
          txb.object(escrow.objectId),
          txb.object(escrow.keyId),
          txb.object(locked.objectId),
          txb.pure.vector('u8', secretArray),
          txb.object('0x6'), // Clock object
        ],
        typeArguments: [escrowType, lockedType],
      });

      txb.transferObjects([result], txb.pure.address(currentAccount.address));

      console.log("Executing transaction...");
      return executeTransaction(txb);
    },
    onSuccess: (data) => {
      console.log("Reveal secret mutation succeeded:", data);
      queryClient.invalidateQueries({ queryKey: [QueryKey.Escrow] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.Locked] });
    },
    onError: (error) => {
      console.error("Reveal secret mutation failed:", error);
    },
  });
}

/**
 * Builds and executes the PTB to create a pure hashlock (HTLC).
 */
export function useCreateHashlockMutation() {
  const currentAccount = useCurrentAccount();
  const executeTransaction = useTransactionExecution();


  return useMutation({
    mutationFn: async ({
      object,
      recipient,
      secret,
      timeoutHours,
    }: {
      object: SuiObjectData;
      recipient: string;
      secret: string;
      timeoutHours: number;
    }) => {
      if (!currentAccount?.address)
        throw new Error("You need to connect your wallet!");

      if (!secret || secret.length < 8)
        throw new Error("Secret must be at least 8 characters long!");

      // Convert secret to hash commitment (SHA-256)
      const hash = sha256(secret);
      const hashBuffer = new Uint8Array(hash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      const timeoutMs = timeoutHours * 60 * 60 * 1000; // Convert hours to milliseconds

      const txb = new Transaction();
      const hashlock = txb.moveCall({
        target: `${CONSTANTS.escrowContract.packageId}::hashlock::create_hashlock_with_duration`,
        arguments: [
          txb.object(object.objectId!),
          txb.pure.vector('u8', hashArray),
          txb.pure.address(recipient),
          txb.pure.u64(timeoutMs),
          txb.object('0x6'), // Clock object
        ],
        typeArguments: [object.type!],
      });


      txb.transferObjects([hashlock], txb.pure.address(currentAccount.address));

      return executeTransaction(txb);
    },
  });
}

/**
 * Builds and executes the PTB to claim a hashlock with a secret.
 */
export function useClaimHashlockMutation() {
  const currentAccount = useCurrentAccount();
  const executeTransaction = useTransactionExecution();

  return useMutation({
    mutationFn: async ({
      hashlockId,
      hashlockType,
      secret,
    }: {
      hashlockId: string;
      hashlockType: string;
      secret: string;
    }) => {
      if (!currentAccount?.address)
        throw new Error("You need to connect your wallet!");

      if (!secret)
        throw new Error("Secret is required!");

      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      const secretArray = Array.from(secretBytes);

      const txb = new Transaction();
      const result = txb.moveCall({
        target: `${CONSTANTS.escrowContract.packageId}::hashlock::claim_with_secret`,
        arguments: [
          txb.object(hashlockId),
          txb.pure.vector('u8', secretArray),
          txb.object('0x6'), // Clock object
        ],
        typeArguments: [hashlockType],
      });

      txb.transferObjects([result], txb.pure.address(currentAccount.address));

      return executeTransaction(txb);
    },
  });
} 

/**
 * Reclaim after timer
 */
export function useReclaimHashlockMutation() {
  const currentAccount = useCurrentAccount();
  const executeTransaction = useTransactionExecution();

  return useMutation({
    mutationFn: async ({
      hashlockId,
      // hashlockType,
    }: {
      hashlockId: string;
      // hashlockType: string;
    }) => {
      if (!currentAccount?.address)
        throw new Error("You need to connect your wallet!");

      const txb = new Transaction();
      const result = txb.moveCall({
        target: `${CONSTANTS.escrowContract.packageId}::hashlock::reclaim_after_timeout`,
        arguments: [
          txb.object(hashlockId),
          txb.object('0x6'), // Clock object
        ],
        // typeArguments: [hashlockType],
      });

      txb.transferObjects([result], txb.pure.address(currentAccount.address));

      return executeTransaction(txb);
    },
  });
} 