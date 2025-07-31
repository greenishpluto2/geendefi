// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { SuiEvent } from '@mysten/sui/client';
import { Prisma } from '@prisma/client';

import { prisma } from '../db';

// Types for hashlock.move events
type HashlockCreated = {
	hashlock_id: string;
	hash_commitment: number[];
	sender: string;
	recipient: string;
	created_at: string;
	expires_at: string;
	item_id: string;
};

type SecretRevealed = {
	hashlock_id: string;
	secret: number[];
	secret_hash: number[];
	revealer: string;
};

// Types for hashlock_shared.move events (already defined in escrow-handler.ts)
type HashlockEscrowCreated = {
	sender: string;
	recipient: string;
	escrow_id: string;
	key_id: string;
	item_id: string;
	hash_commitment: number[];
	created_at: string;
	expires_at: string;
};

type HashlockEscrowSwapped = {
	escrow_id: string;
	swapper: string;
};

type HashlockEscrowCancelled = {
	escrow_id: string;
	reason: number;
};

type HashlockEvent = HashlockCreated | SecretRevealed | HashlockEscrowCreated | HashlockEscrowSwapped | HashlockEscrowCancelled;

/**
 * Handles all events emitted by the `hashlock` and `hashlock_shared` modules.
 * This creates entries in both the Locked table (for hashlock objects) and 
 * Escrow table (for hashlock escrows).
 */
export const handleHashlockObjects = async (events: SuiEvent[], type: string) => {
	console.log(`Processing ${events.length} hashlock events for type: ${type}`);
	
	const lockedUpdates: Record<string, Prisma.LockedCreateInput> = {};
	const escrowUpdates: Record<string, Prisma.EscrowCreateInput> = {};

	for (const event of events) {
		if (!event.type.startsWith(type)) throw new Error('Invalid event module origin');
		const data = event.parsedJson as HashlockEvent;
		
		console.log(`Processing event: ${event.type}`, data);

		// Handle pure hashlock events (hashlock.move)
		if (event.type.endsWith('::HashlockCreated')) {
			const hashlockData = data as HashlockCreated;
			
			if (!Object.hasOwn(lockedUpdates, hashlockData.hashlock_id)) {
				lockedUpdates[hashlockData.hashlock_id] = {
					objectId: hashlockData.hashlock_id,
				};
			}

			lockedUpdates[hashlockData.hashlock_id].creator = hashlockData.sender;
			lockedUpdates[hashlockData.hashlock_id].itemId = hashlockData.item_id;
			// For hashlock, we don't have a separate key, so we use the hashlock_id as keyId
			lockedUpdates[hashlockData.hashlock_id].keyId = hashlockData.hashlock_id;
			console.log(`Added hashlock creation for ID: ${hashlockData.hashlock_id}`);
			continue;
		}

		// Handle hashlock escrow events (hashlock_shared.move)
		if (event.type.endsWith('::HashlockEscrowCreated')) {
			const escrowData = data as HashlockEscrowCreated;
			
			if (!Object.hasOwn(escrowUpdates, escrowData.escrow_id)) {
				escrowUpdates[escrowData.escrow_id] = {
					objectId: escrowData.escrow_id,
				};
			}

			escrowUpdates[escrowData.escrow_id].sender = escrowData.sender;
			escrowUpdates[escrowData.escrow_id].recipient = escrowData.recipient;
			escrowUpdates[escrowData.escrow_id].keyId = escrowData.key_id;
			escrowUpdates[escrowData.escrow_id].itemId = escrowData.item_id;
			escrowUpdates[escrowData.escrow_id].isHashlock = true;
			escrowUpdates[escrowData.escrow_id].hashCommitment = Buffer.from(escrowData.hash_commitment).toString('hex');
			escrowUpdates[escrowData.escrow_id].timeoutMs = escrowData.expires_at;
			console.log(`Added hashlock escrow creation for ID: ${escrowData.escrow_id}`);
			continue;
		}

		// Handle secret revelation events
		if (event.type.endsWith('::SecretRevealed')) {
			const secretData = data as SecretRevealed;
			
			// Check if it's a pure hashlock secret revelation
			if ('hashlock_id' in secretData && secretData.hashlock_id) {
				if (!Object.hasOwn(lockedUpdates, secretData.hashlock_id)) {
					lockedUpdates[secretData.hashlock_id] = {
						objectId: secretData.hashlock_id,
					};
				}
				lockedUpdates[secretData.hashlock_id].deleted = true; // Hashlock is consumed
				console.log(`Marked hashlock as consumed: ${secretData.hashlock_id}`);
			}
			
			// Check if it's a hashlock escrow secret revelation
			if ('escrow_id' in (secretData as any)) {
				const escrowId = (secretData as any).escrow_id;
				if (!Object.hasOwn(escrowUpdates, escrowId)) {
					escrowUpdates[escrowId] = {
						objectId: escrowId,
					};
				}
				escrowUpdates[escrowId].secretRevealed = Buffer.from(secretData.secret).toString('hex');
				console.log(`Added secret revelation for escrow: ${escrowId}`);
			}
			continue;
		}

		// Handle hashlock escrow swap events
		if (event.type.endsWith('::HashlockEscrowSwapped')) {
			const swapData = data as HashlockEscrowSwapped;
			
			if (!Object.hasOwn(escrowUpdates, swapData.escrow_id)) {
				escrowUpdates[swapData.escrow_id] = {
					objectId: swapData.escrow_id,
				};
			}

			escrowUpdates[swapData.escrow_id].swapped = true;
			console.log(`Marked hashlock escrow as swapped: ${swapData.escrow_id}`);
			continue;
		}

		// Handle hashlock escrow cancellation events
		if (event.type.endsWith('::HashlockEscrowCancelled')) {
			const cancelData = data as HashlockEscrowCancelled;
			
			if (!Object.hasOwn(escrowUpdates, cancelData.escrow_id)) {
				escrowUpdates[cancelData.escrow_id] = {
					objectId: cancelData.escrow_id,
				};
			}

			escrowUpdates[cancelData.escrow_id].cancelled = true;
			console.log(`Marked hashlock escrow as cancelled: ${cancelData.escrow_id}`);
			continue;
		}
	}

	console.log(`Updating ${Object.keys(lockedUpdates).length} locked objects and ${Object.keys(escrowUpdates).length} escrow objects`);

	// Update locked objects (for pure hashlocks)
	const lockedPromises = Object.values(lockedUpdates).map((update) =>
		prisma.locked.upsert({
			where: {
				objectId: update.objectId,
			},
			create: update,
			update,
		}),
	);

	// Update escrow objects (for hashlock escrows)
	const escrowPromises = Object.values(escrowUpdates).map((update) =>
		prisma.escrow.upsert({
			where: {
				objectId: update.objectId,
			},
			create: update,
			update,
		}),
	);

	await Promise.all([...lockedPromises, ...escrowPromises]);
	console.log(`Successfully processed hashlock events`);
}; 