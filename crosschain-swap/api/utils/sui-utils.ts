// Copyright (c) 2024
// SPDX-License-Identifier: MIT

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export const ACTIVE_NETWORK = (process.env.NETWORK as Network) || 'testnet';

export const SUI_BIN = `sui`;

export const getActiveAddress = () => {
	return execSync(`${SUI_BIN} client active-address`, { encoding: 'utf8' }).trim();
};

/** Returns a signer based on the active address of system's sui. */
export const getSigner = () => {
	const sender = getActiveAddress();

	const keystore = JSON.parse(
		readFileSync(path.join(homedir(), '.sui', 'sui_config', 'sui.keystore'), 'utf8'),
	);

	for (const priv of keystore) {
		const raw = fromBase64(priv);
		if (raw[0] !== 0) {
			continue;
		}

		const pair = Ed25519Keypair.fromSecretKey(raw.slice(1));
		if (pair.getPublicKey().toSuiAddress() === sender) {
			return pair;
		}
	}

	throw new Error(`keypair not found for sender: ${sender}`);
};

/** Get the client for the specified network. */
export const getClient = (network: Network) => {
	return new SuiClient({ url: getFullnodeUrl(network) });
};

/** A helper to sign & execute a transaction. */
export const signAndExecute = async (txb: Transaction, network: Network) => {
	const client = getClient(network);
	const signer = getSigner();

	return client.signAndExecuteTransaction({
		transaction: txb,
		signer,
		options: {
			showEffects: true,
			showObjectChanges: true,
		},
	});
};

/** Publishes a package and saves the package id to a specified json file. */
export const publishPackage = async ({
	packagePath,
	network,
	exportFileName = 'contract',
}: {
	packagePath: string;
	network: Network;
	exportFileName: string;
}) => {
	console.log(`📦 Publishing package from: ${packagePath}`);
	console.log(`🌐 Network: ${network}`);
	console.log(`👤 Active address: ${getActiveAddress()}`);

	const txb = new Transaction();

	const { modules, dependencies } = JSON.parse(
		execSync(`${SUI_BIN} move build --dump-bytecode-as-base64 --path ${packagePath}`, {
			encoding: 'utf-8',
		}),
	);

	const cap = txb.publish({
		modules,
		dependencies,
	});

	// Transfer the upgrade capability to the sender so they can upgrade the package later if they want.
	txb.transferObjects([cap], getActiveAddress());

	const results = await signAndExecute(txb, network);

	console.log(`✅ Transaction successful: ${results.digest}`);

	// @ts-ignore-next-line
	const packageId = results.objectChanges?.find((x) => x.type === 'published')?.packageId;

	if (!packageId) {
		throw new Error('Package ID not found in transaction results');
	}

	console.log(`📋 Package ID: ${packageId}`);

	// Find the EscrowFactory object that was created
	const factoryObject = results.objectChanges?.find(
		(x) => x.type === 'created' && x.objectType?.includes('EscrowFactory')
	);

	const factoryId = factoryObject && factoryObject.type === 'created' ? factoryObject.objectId : undefined;
	
	// save to a json file
	const config = {
		packageId,
		factoryId,
		network,
		deployedAt: Date.now(),
		deployer: getActiveAddress(),
		digest: results.digest,
	};

	writeFileSync(
		`${exportFileName}.json`,
		JSON.stringify(config, null, 2),
		{ encoding: 'utf8', flag: 'w' },
	);

	console.log(`💾 Configuration saved to: ${exportFileName}.json`);
	
	return config;
}; 