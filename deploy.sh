#!/bin/bash

# Deployment script for Savings Vault Contract
# Usage: ./deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}

echo "========================================="
echo "Stacks Savings Vault Deployment Script"
echo "========================================="
echo ""

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
    echo "Error: Invalid network. Use 'testnet' or 'mainnet'"
    exit 1
fi

echo "Network: $NETWORK"
echo ""

# Check if clarinet is installed
if ! command -v clarinet &> /dev/null; then
    echo "Error: Clarinet is not installed"
    echo "Install it from: https://github.com/hirosystems/clarinet"
    exit 1
fi

echo "✓ Clarinet is installed"
echo ""

# Check Clarinet.toml exists
if [ ! -f "Clarinet.toml" ]; then
    echo "Error: Clarinet.toml not found"
    echo "Make sure you're in the project root directory"
    exit 1
fi

echo "✓ Project configuration found"
echo ""

# Mainnet warning
if [ "$NETWORK" == "mainnet" ]; then
    echo "⚠️  WARNING: You are about to deploy to MAINNET"
    echo ""
    echo "Before proceeding, ensure:"
    echo "  1. Contract has been thoroughly tested on testnet"
    echo "  2. Security audit has been completed"
    echo "  3. You have sufficient STX for deployment fees"
    echo "  4. Mnemonic is backed up securely"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Run checks
echo "Running contract checks..."
clarinet check
echo "✓ Contract checks passed"
echo ""

# Run tests
if [ "$NETWORK" == "testnet" ]; then
    echo "Running tests..."
    clarinet test
    echo "✓ Tests passed"
    echo ""
fi

# Generate deployment plan
echo "Generating deployment plan..."
clarinet deployments generate --$NETWORK
echo "✓ Deployment plan generated"
echo ""

# Show deployment plan
echo "Deployment plan location:"
echo "deployments/default.$NETWORK-plan.yaml"
echo ""

# Deploy
echo "Starting deployment to $NETWORK..."
clarinet deployments apply --$NETWORK

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Verify the contract on Stacks Explorer"
if [ "$NETWORK" == "testnet" ]; then
    echo "   https://explorer.hiro.so/txid/YOUR_TX_ID?chain=testnet"
else
    echo "   https://explorer.hiro.so/txid/YOUR_TX_ID"
fi
echo "2. Test contract functions"
echo "3. Fund the contract for interest payments"
echo ""
echo "Contract functions:"
echo "  - deposit (amount, lock-period)"
echo "  - withdraw"
echo "  - claim-interest"
echo "  - emergency-withdraw"
echo ""

# Save deployment info
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_LOG="deployments/deployment_${NETWORK}_${TIMESTAMP}.log"

echo "Deployment completed at $(date)" > $DEPLOY_LOG
echo "Network: $NETWORK" >> $DEPLOY_LOG
echo "Check deployment details in Stacks Explorer" >> $DEPLOY_LOG

echo "Deployment log saved to: $DEPLOY_LOG"
