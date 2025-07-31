#!/usr/bin/env npx ts-node

// Copyright (c) 2024
// SPDX-License-Identifier: MIT

import { Transaction } from '@mysten/sui/transactions';
import { getClient, getSigner, signAndExecute, ACTIVE_NETWORK, getActiveAddress } from '../utils/sui-utils';
import { keccak256 } from 'js-sha3';
import { readFileSync } from 'fs';
import { fromBase64 } from '@mysten/sui/utils';

/**
 * Create demo atomic swaps for testing
 * 
 * This script creates test escrows on Sui to demonstrate the cross-chain
 * atomic swap functionality.
 */

interface ContractConfig {
	packageId: string;
	factoryId?: string;
	network: string;
}

function loadContractConfig(): ContractConfig {
	try {
		const config = JSON.parse(readFileSync('crosschain-htlc-contract.json', 'utf8'));
		console.log('📋 Loaded contract configuration:', config);
		return config;
	} catch (error) {
		console.error('❌ Failed to load contract configuration. Make sure to run deployment first:');
		console.error('   npm run deploy');
		process.exit(1);
	}
}

async function createDemoSwaps() {
	console.log('🧪 Creating Demo Cross-Chain Atomic Swaps');
	console.log('=========================================');

	const config = loadContractConfig();
	const client = getClient(ACTIVE_NETWORK);
	
	// Generate demo secrets and their hashes
	const demoSwaps = [
		{
			secret: 'demo_secret_1_32_bytes_length!!!',
			amount: 5000000, // 0.005 SUI in MIST
			ethAddress: '0x742d35Cc6635C0532925a3b8D0A9e2B9c2b6F5f1',
			timeoutHours: 24,
			description: 'Demo swap: 0.005 SUI → ETH'
		},
		{
			secret: 'demo_secret_2_for_testing_swap!!',
			amount: 3000000, // 0.003 SUI in MIST
			ethAddress: '0x1234567890123456789012345678901234567890',
			timeoutHours: 48,
			description: 'Demo swap: 0.003 SUI → ETH'
		},
		{
			secret: 'demo_secret_3_crosschain_htlc!!!',
			amount: 7000000, // 0.007 SUI in MIST
			ethAddress: '0xAbcdEf123456789012345678901234567890AbCd',
			timeoutHours: 12,
			description: 'Demo swap: 0.007 SUI → ETH'
		}
	];

	console.log(`👤 Active address: ${getActiveAddress()}`);
	console.log(`📦 Package ID: ${config.packageId}`);

	// Get a gas coin for transactions
	const coins = await client.getCoins({
		owner: getActiveAddress(),
		coinType: '0x2::sui::SUI',
	});

	if (coins.data.length === 0) {
		console.error('❌ No SUI coins found. Make sure you have SUI in your wallet.');
		process.exit(1);
	}

	console.log(`💰 Available coins: ${coins.data.length}`);
	console.log(`💰 Total balance: ${coins.data.reduce((sum, coin) => sum + parseInt(coin.balance), 0) / 1e9} SUI`);

	// Create escrows for each demo swap
	for (let i = 0; i < demoSwaps.length; i++) {
		const swap = demoSwaps[i];
		console.log(`\n📝 Creating escrow ${i + 1}/3: ${swap.description}`);

		try {
			// Calculate hash commitment
			const secretBytes = new TextEncoder().encode(swap.secret);
			const hashHex = keccak256(secretBytes);
			const hashArray = Array.from(Buffer.from(hashHex, 'hex'));

			console.log(`🔐 Secret: ${swap.secret}`);
			console.log(`🔒 Hash: ${hashHex}`);

			// Convert ETH address to bytes
			const ethAddressBytes = Array.from(Buffer.from(swap.ethAddress.slice(2), 'hex'));

			// Calculate deadline (current time + timeout hours)
			const deadline = Date.now() + (swap.timeoutHours * 60 * 60 * 1000);

			// Create transaction
			const txb = new Transaction();

			// Find suitable coin for this escrow amount
			const suitableCoin = coins.data.find(coin => parseInt(coin.balance) >= swap.amount);
			if (!suitableCoin) {
				console.error(`❌ No coin with sufficient balance for ${swap.amount} MIST`);
				continue;
			}

			// Split coin if needed
			let coinToUse;
			if (parseInt(suitableCoin.balance) === swap.amount) {
				coinToUse = txb.object(suitableCoin.coinObjectId);
			} else {
				const [splitCoin] = txb.splitCoins(txb.object(suitableCoin.coinObjectId), [swap.amount]);
				coinToUse = splitCoin;
			}

			// Call setup_escrow function
			txb.moveCall({
				target: `${config.packageId}::escrow::setup_escrow`,
				arguments: [
					// Note: We need the factory object ID - for now using a placeholder
					txb.object(config.factoryId || '0x6'), // Will need actual factory ID
					coinToUse,
					txb.pure.u64(swap.amount),
					txb.pure.vector('u8', hashArray),
					txb.pure.vector('u8', ethAddressBytes),
					txb.pure.u64(deadline),
					txb.object('0x6'), // Clock object
				],
			});

			// Execute transaction
			const result = await signAndExecute(txb, ACTIVE_NETWORK);

			console.log(`✅ Escrow created successfully!`);
			console.log(`🔗 Transaction: ${result.digest}`);

			// Find the created escrow object
			const createdEscrow = result.objectChanges?.find(
				(obj) => obj.type === 'created' && obj.objectType?.includes('Escrow')
			);

			if (createdEscrow && createdEscrow.type === 'created') {
				console.log(`📦 Escrow Object ID: ${createdEscrow.objectId}`);
			}

			// Wait a bit between transactions
			await new Promise(resolve => setTimeout(resolve, 2000));

		} catch (error) {
			console.error(`❌ Failed to create escrow ${i + 1}:`, error);
		}
	}

	console.log('\n🎉 Demo escrows creation completed!');
	console.log('=================================');
	console.log('\n📱 Frontend Testing:');
	console.log('1. Start the frontend: cd ../frontend && pnpm dev');
	console.log('2. Navigate to http://localhost:3002');
	console.log('3. Connect your wallet');
	console.log('4. Go to "My Swaps" to see created escrows');
	console.log('5. Try claiming with the demo secrets above');

	console.log('\n🔍 Manual Testing:');
	console.log('You can test claiming escrows with these secrets:');
	demoSwaps.forEach((swap, i) => {
		console.log(`   ${i + 1}. "${swap.secret}" for ${swap.description}`);
	});
}

// Run the demo creation if this script is executed directly
if (require.main === module) {
	createDemoSwaps().catch(console.error);
}

export { createDemoSwaps }; 