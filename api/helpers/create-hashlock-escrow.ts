// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import crypto from 'crypto';
import { keccak256 } from 'js-sha3';

import { CONFIG } from '../config';
import { getActiveAddress, signAndExecute } from '../sui-utils';

/**
 * Creates a hashlock escrow with a secret commitment
 */
export const createHashlockEscrow = async (params: {
	objectId: string;
	objectType: string;
	exchangeKeyId: string;
	recipient: string;
	secret: string;
	timeoutMs: number;
}) => {
	const { objectId, objectType, exchangeKeyId, recipient, secret, timeoutMs } = params;
	
	// Create hash commitment from secret using keccak256 (same as Move contract)
	const hashCommitment = Buffer.from(keccak256(secret), 'hex');

	const txb = new Transaction();

	txb.moveCall({
		target: `${CONFIG.SWAP_CONTRACT.packageId}::hashlock_shared::create_hashlock_escrow_with_duration`,
		arguments: [
			txb.object(objectId),
			txb.pure.id(exchangeKeyId),
			txb.pure.address(recipient),
			txb.pure.vector('u8', Array.from(hashCommitment)),
			txb.pure.u64(timeoutMs),
			txb.object('0x6'), // Clock object
		],
		typeArguments: [objectType],
	});

	const result = await signAndExecute(txb, CONFIG.NETWORK);
	
	return {
		result,
		secret, // Return secret for demo purposes - in real app, this should be stored securely
		hashCommitment: Array.from(hashCommitment),
	};
};

/**
 * Reveals secret and completes hashlock escrow swap
 */
export const revealSecretAndSwap = async (params: {
	escrowId: string;
	escrowType: string;
	keyId: string;
	lockedObjectId: string;
	lockedObjectType: string;
	secret: string;
}) => {
	const { escrowId, escrowType, keyId, lockedObjectId, lockedObjectType, secret } = params;

	const txb = new Transaction();

	txb.moveCall({
		target: `${CONFIG.SWAP_CONTRACT.packageId}::hashlock_shared::swap_with_secret`,
		arguments: [
			txb.object(escrowId),
			txb.object(keyId),
			txb.object(lockedObjectId),
			txb.pure.vector('u8', Array.from(Buffer.from(secret))),
			txb.object('0x6'), // Clock object
		],
		typeArguments: [escrowType, lockedObjectType],
	});

	return signAndExecute(txb, CONFIG.NETWORK);
};

/**
 * Creates a pure hashlock (HTLC) for an object
 */
export const createHashlock = async (params: {
	objectId: string;
	objectType: string;
	recipient: string;
	secret: string;
	timeoutMs: number;
}) => {
	const { objectId, objectType, recipient, secret, timeoutMs } = params;
	
	// Create hash commitment from secret using keccak256 (same as Move contract)
	const hashCommitment = Buffer.from(keccak256(secret), 'hex');

	const txb = new Transaction();

	const hashlock = txb.moveCall({
		target: `${CONFIG.SWAP_CONTRACT.packageId}::hashlock::create_hashlock_with_duration`,
		arguments: [
			txb.object(objectId),
			txb.pure.vector('u8', Array.from(hashCommitment)),
			txb.pure.address(recipient),
			txb.pure.u64(timeoutMs),
			txb.object('0x6'), // Clock object
		],
		typeArguments: [objectType],
	});

	// Transfer the hashlock to the sender for storage
	txb.transferObjects([hashlock], txb.pure.address(getActiveAddress()));

	const result = await signAndExecute(txb, CONFIG.NETWORK);
	
	return {
		result,
		secret,
		hashCommitment: Array.from(hashCommitment),
	};
}; 