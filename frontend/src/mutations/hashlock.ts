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

      // Determine the exchange key based on the locked object type
      // For Locked objects (lock module): use keyId
      // For Hashlocked objects (hashlock module): use objectId
      let exchangeKey;
      if (locked.keyId && locked.keyId !== "") {
        // This is likely a Locked object with a separate Key
        exchangeKey = locked.keyId;
        console.log("Using keyId as exchange key (Locked object):", exchangeKey);
      } else {
        // This is likely a Hashlocked object where objectId = keyId
        exchangeKey = locked.objectId;
        console.log("Using objectId as exchange key (Hashlocked object):", exchangeKey);
      }

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
          txb.pure.id(exchangeKey),
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

      // Verify secret matches using keccak256 (same as Move contract)
      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      
      // Calculate keccak256 hash
      const keccak256Hex = keccak256(secretBytes);

      console.log("Hash comparison:", { 
        storedHash: escrow.hashCommitment,
        keccak256Hash: keccak256Hex,
        keccak256Matches: keccak256Hex === escrow.hashCommitment
      });

      if (keccak256Hex !== escrow.hashCommitment) {
        throw new Error(`Invalid secret! The keccak256 hash doesn't match the stored commitment.`);
      }

      console.log("Secret verified with keccak256 hash");

      // Get the actual types of the objects and the locked object wrapper type
      console.log("Fetching object types for:", [escrow.itemId, locked.itemId, locked.objectId]);
      
      const objectsToFetch = [escrow.itemId, locked.itemId, locked.objectId];
      const fetchedObjects = await client.multiGetObjects({
        ids: objectsToFetch,
        options: {
          showType: true,
          showContent: true,
        },
      });

      const escrowType = fetchedObjects.find(
        (x) => x.data?.objectId === escrow.itemId,
      )?.data?.type;

      const lockedType = fetchedObjects.find(
        (x) => x.data?.objectId === locked.itemId,
      )?.data?.type;

      const lockedObjectType = fetchedObjects.find(
        (x) => x.data?.objectId === locked.objectId,
      )?.data?.type;

      const lockedObjectData = fetchedObjects.find(
        (x) => x.data?.objectId === locked.objectId,
      )?.data;

      console.log("Resolved types:", { escrowType, lockedType, lockedObjectType });
      console.log("Locked object data:", lockedObjectData);

      // For hashlocked objects, check the recipient field
      if (lockedObjectData?.content?.dataType === "moveObject") {
        console.log("Hashlocked object fields:", lockedObjectData.content.fields);
        console.log("Current account:", currentAccount.address);
        console.log("Hashlocked recipient:", (lockedObjectData.content.fields as any)?.recipient);
        
        // Check if current account can perform this operation for hashlocked objects
        const hashlockRecipient = (lockedObjectData.content.fields as any)?.recipient;
        
        if (hashlockRecipient && hashlockRecipient !== currentAccount.address) {
          console.error("Account mismatch for hashlock operation!");
          console.error("Current account:", currentAccount.address);
          console.error("Hashlock recipient:", hashlockRecipient);
          console.error("Escrow recipient:", escrow.recipient);
          
          throw new Error(`Account mismatch! You (${currentAccount.address}) are not the recipient of the hashlock object (${hashlockRecipient}). Only the hashlock recipient can reveal the secret to claim the hashlock. This operation should be performed by the hashlock recipient.`);
        }
      }

      if (!escrowType || !lockedType || !lockedObjectType) {
        throw new Error("Failed to fetch object types.");
      }

      const secretArray = Array.from(secretBytes);
      const txb = new Transaction();

      // Check if the locked object is a Hashlocked or a Locked object
      const isHashlocked = lockedObjectType.includes("::hashlock::Hashlocked");
      
      console.log("Is hashlocked object:", isHashlocked);

      let result;
      if (isHashlocked) {
        // Use hashlock-to-hashlock swap function
        console.log("Building transaction with hashlock_shared::swap_hashlock_for_hashlock");
        result = txb.moveCall({
          target: `${CONSTANTS.escrowContract.packageId}::hashlock_shared::swap_hashlock_for_hashlock`,
          arguments: [
            txb.object(escrow.objectId),
            txb.object(locked.objectId),
            txb.pure.vector('u8', secretArray),
            txb.object('0x6'), // Clock object
          ],
          typeArguments: [escrowType, lockedType],
        });
      } else {
        // Use regular escrow swap function for Locked objects
        console.log("Building transaction with hashlock_shared::swap_with_secret");
        result = txb.moveCall({
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
      }

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

      // Convert secret to hash commitment using keccak256 (same as Move contract)
      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      const hashHex = keccak256(secretBytes);
      
      // Convert hex string to byte array
      const hashArray = [];
      for (let i = 0; i < hashHex.length; i += 2) {
        hashArray.push(parseInt(hashHex.substr(i, 2), 16));
      }

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
      hashlockType,
    }: {
      hashlockId: string;
      hashlockType: string;
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
        typeArguments: [hashlockType],
      });

      txb.transferObjects([result], txb.pure.address(currentAccount.address));

      return executeTransaction(txb);
    },
  });
} 