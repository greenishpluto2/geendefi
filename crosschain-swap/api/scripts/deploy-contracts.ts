#!/usr/bin/env npx ts-node

// Copyright (c) 2024
// SPDX-License-Identifier: MIT

import { publishPackage, ACTIVE_NETWORK } from '../utils/sui-utils';
import path from 'path';

/**
 * Deploy Cross-Chain HTLC contracts to Sui
 * 
 * This script deploys the cross-chain atomic swap contracts and saves
 * the configuration for use in the frontend and API.
 */
async function deployContracts() {
	console.log('🚀 Starting Cross-Chain HTLC Contract Deployment');
	console.log('================================================');

	try {
		// Deploy the cross-chain HTLC package
		const contractsPath = path.resolve(__dirname, '../../contracts/crosschain_htlc');
		
		console.log(`📂 Contract path: ${contractsPath}`);
		
		const config = await publishPackage({
			packagePath: contractsPath,
			network: ACTIVE_NETWORK,
			exportFileName: 'crosschain-htlc-contract',
		});

		console.log('\n🎉 Deployment successful!');
		console.log('========================');
		console.log(`📋 Package ID: ${config.packageId}`);
		console.log(`🏭 Factory ID: ${config.factoryId || 'N/A'}`);
		console.log(`🌐 Network: ${config.network}`);
		console.log(`👤 Deployer: ${config.deployer}`);
		console.log(`🔗 Digest: ${config.digest}`);

		console.log('\n📝 Next Steps:');
		console.log('==============');
		console.log('1. Update frontend configuration:');
		console.log(`   - Open: crosschain-swap/frontend/src/constants/network.ts`);
		console.log(`   - Set CONTRACTS.PACKAGE_ID = "${config.packageId}"`);
		console.log(`   - Set CONTRACTS.ESCROW_FACTORY = "${config.factoryId || 'FACTORY_ID_HERE'}"`);
		console.log('\n2. Test the deployment:');
		console.log('   - Run: npm run create-demo');
		console.log('\n3. Start the frontend:');
		console.log('   - cd ../frontend && pnpm dev');

		return config;

	} catch (error) {
		console.error('❌ Deployment failed:', error);
		process.exit(1);
	}
}

// Run the deployment if this script is executed directly
if (require.main === module) {
	deployContracts().catch(console.error);
}

export { deployContracts }; 