#!/usr/bin/env npx ts-node

// Copyright (c) 2024
// SPDX-License-Identifier: MIT

import { getClient, ACTIVE_NETWORK } from '../utils/sui-utils';
import { readFileSync } from 'fs';

/**
 * Event Monitor for Cross-Chain Atomic Swaps
 * 
 * This script monitors Sui events for PreimageRevealed events that
 * relayers would use to complete swaps on the Ethereum side.
 */

interface ContractConfig {
	packageId: string;
	factoryId?: string;
	network: string;
}

function loadContractConfig(): ContractConfig {
	try {
		const config = JSON.parse(readFileSync('crosschain-htlc-contract.json', 'utf8'));
		return config;
	} catch (error) {
		console.error('❌ Failed to load contract configuration. Make sure to run deployment first:');
		console.error('   npm run deploy');
		process.exit(1);
	}
}

async function monitorEvents() {
	console.log('👁️  Cross-Chain HTLC Event Monitor');
	console.log('===================================');

	const config = loadContractConfig();
	const client = getClient(ACTIVE_NETWORK);

	console.log(`📦 Package ID: ${config.packageId}`);
	console.log(`🌐 Network: ${config.network}`);
	console.log(`⏰ Started at: ${new Date().toISOString()}`);
	console.log('\n🔍 Monitoring for events...\n');

	let lastCheckpoint: string | null = null;

	const eventTypes = [
		`${config.packageId}::escrow::EscrowCreated`,
		`${config.packageId}::escrow::PreimageRevealed`,
		`${config.packageId}::escrow::EscrowRefunded`,
	];

	while (true) {
		try {
			for (const eventType of eventTypes) {
				const events = await client.queryEvents({
					query: { MoveEventType: eventType },
					limit: 10,
					order: 'descending',
				});

				for (const event of events.data) {
					// Simple deduplication - in production you'd use a database
					if (lastCheckpoint && event.id.txDigest === lastCheckpoint) {
						continue;
					}

					const eventData = event.parsedJson as any;
					const timestamp = new Date(parseInt(event.timestampMs || '0')).toISOString();

					console.log(`📡 ${event.type.split('::').pop()} Event`);
					console.log(`   🔗 TX: ${event.id.txDigest}`);
					console.log(`   ⏰ Time: ${timestamp}`);

					if (event.type.includes('EscrowCreated')) {
						console.log(`   📦 Escrow ID: ${eventData.escrow_id}`);
						console.log(`   👤 Creator: ${eventData.creator}`);
						console.log(`   💰 Amount: ${eventData.amount} MIST`);
						console.log(`   🔒 Hash: ${Buffer.from(eventData.hashlock).toString('hex')}`);
						console.log(`   📅 Deadline: ${new Date(eventData.deadline).toISOString()}`);
						console.log(`   🔗 ETH Address: 0x${Buffer.from(eventData.eth_receiver).toString('hex')}`);
						console.log('   🎯 Action: Ready for Ethereum-side matching');
					} 
					else if (event.type.includes('PreimageRevealed')) {
						const preimage = Buffer.from(eventData.preimage).toString();
						const preimageHex = Buffer.from(eventData.preimage).toString('hex');
						
						console.log(`   🔓 SECRET REVEALED! 🔓`);
						console.log(`   📦 Escrow ID: ${eventData.escrow_id}`);
						console.log(`   👤 Claimer: ${eventData.claimer}`);
						console.log(`   💰 Amount: ${eventData.amount} MIST`);
						console.log(`   🔐 Secret: "${preimage}"`);
						console.log(`   🔐 Secret (hex): ${preimageHex}`);
						console.log('   🚀 Action: Relayer should claim on Ethereum with this secret!');
					}
					else if (event.type.includes('EscrowRefunded')) {
						console.log(`   📦 Escrow ID: ${eventData.escrow_id}`);
						console.log(`   👤 Creator: ${eventData.creator}`);
						console.log(`   💰 Refund: ${eventData.amount} MIST`);
						console.log('   ⏰ Action: Timeout reached, funds returned');
					}

					console.log('');
				}

				if (events.data.length > 0) {
					lastCheckpoint = events.data[0].id.txDigest;
				}
			}

			// Wait 5 seconds before next check
			await new Promise(resolve => setTimeout(resolve, 5000));

		} catch (error) {
			console.error('❌ Error monitoring events:', error);
			await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s on error
		}
	}
}

// Run the event monitor if this script is executed directly
if (require.main === module) {
	monitorEvents().catch(console.error);
}

export { monitorEvents }; 