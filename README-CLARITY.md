# Savings Vault Smart Contract - Stacks Blockchain (Clarity)

A secure and feature-rich savings vault smart contract written in Clarity for the Stacks blockchain. Users can deposit STX, earn interest, and manage their savings with time-locked withdrawals.

## 🌟 Features

- **STX Deposits**: Securely deposit STX tokens with customizable lock periods
- **Time-Locked Savings**: Lock funds for 1-365 days to encourage savings discipline
- **Interest Accrual**: Earn interest on deposits based on configurable annual rate
- **Interest Claims**: Claim accrued interest at any time
- **Flexible Withdrawals**: Withdraw after lock period expires
- **Emergency Withdrawals**: Access funds early with a 10% penalty
- **Admin Controls**: Owner functions for managing rates, pausing, and funding
- **User Statistics**: Track total deposits, withdrawals, and interest earned
- **TVL Tracking**: Monitor total value locked in the contract

## 📋 Contract Specifications

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `basis-points` | 10000 | Used for percentage calculations |
| `blocks-per-year` | 52560 | ~144 blocks/day × 365 days |
| `min-lock-blocks` | 144 | Minimum lock period (1 day) |
| `max-lock-blocks` | 52560 | Maximum lock period (365 days) |
| `emergency-penalty-rate` | 1000 | 10% penalty for early withdrawal |

### Default Configuration

- **Annual Interest Rate**: 5% (500 basis points)
- **Minimum Deposit**: 1 STX (1,000,000 microSTX)
- **Initial State**: Unpaused

## 🚀 Deployment

### Prerequisites

1. Install [Clarinet](https://github.com/hirosystems/clarinet)
```bash
# macOS/Linux
curl -L https://github.com/hirosystems/clarinet/releases/download/v1.8.0/clarinet-linux-x64.tar.gz | tar xz
sudo mv clarinet /usr/local/bin/

# Or with brew
brew install clarinet
```

2. Verify installation
```bash
clarinet --version
```

### Setup Project

1. **Create a new Clarinet project**:
```bash
clarinet new stacks-savings-vault
cd stacks-savings-vault
```

2. **Add the contract**:
```bash
# Copy savings-vault.clar to contracts/ directory
cp /path/to/savings-vault.clar contracts/
```

3. **Update Clarinet.toml**:
```toml
[project]
name = "stacks-savings-vault"
requirements = []

[contracts.savings-vault]
path = "contracts/savings-vault.clar"
clarity_version = 2
epoch = 2.5
```

### Testing

1. **Run tests**:
```bash
# Copy test file to tests/ directory
cp /path/to/savings-vault_test.clar tests/

# Run all tests
clarinet test

# Run specific test
clarinet test tests/savings-vault_test.clar
```

2. **Interactive console**:
```bash
clarinet console

# In console:
(contract-call? .savings-vault get-contract-config)
(contract-call? .savings-vault deposit u5000000 u1440)
```

### Deploy to Testnet

1. **Configure deployment** (settings/Testnet.toml):
```toml
[network]
name = "testnet"
deployment_fee_rate = 10

[accounts.deployer]
mnemonic = "your mnemonic here"
balance = 100_000_000_000
```

2. **Deploy contract**:
```bash
# Deploy to testnet
clarinet deployments apply --testnet

# Or deploy to mainnet (when ready)
clarinet deployments apply --mainnet
```

3. **Generate deployment plan**:
```bash
clarinet deployments generate --testnet
```

### Deploy to Mainnet

```bash
# Generate mainnet deployment plan
clarinet deployments generate --mainnet

# Review and execute
clarinet deployments apply --mainnet
```

## 📖 Usage Guide

### User Functions

#### 1. Deposit STX

Deposit STX with a specified lock period (in blocks).

```clarity
;; Deposit 10 STX with 1440 blocks lock (~10 days)
(contract-call? .savings-vault deposit u10000000 u1440)

;; Parameters:
;; - amount: Amount in microSTX (1 STX = 1,000,000 microSTX)
;; - lock-period: Lock period in blocks (144-52560 blocks)
```

**Lock Period Examples**:
- 1 day: 144 blocks
- 7 days: 1008 blocks
- 30 days: 4320 blocks
- 90 days: 12960 blocks
- 180 days: 25920 blocks
- 365 days: 52560 blocks

#### 2. Check Savings

```clarity
;; Get your savings details
(contract-call? .savings-vault get-user-savings tx-sender)

;; Returns:
;; {
;;   balance: uint,           ;; Current balance
;;   deposit-block: uint,     ;; Block height when deposited
;;   lock-period: uint,       ;; Lock period in blocks
;;   last-interest-claim: uint ;; Last interest claim block
;; }
```

#### 3. Calculate Pending Interest

```clarity
;; Calculate interest accrued since last claim
(contract-call? .savings-vault calculate-interest tx-sender)

;; Returns interest amount in microSTX
```

#### 4. Claim Interest

```clarity
;; Claim all pending interest
(contract-call? .savings-vault claim-interest)
```

#### 5. Check Withdrawal Eligibility

```clarity
;; Check if you can withdraw
(contract-call? .savings-vault can-withdraw tx-sender)

;; Get unlock block height
(contract-call? .savings-vault get-unlock-block tx-sender)
```

#### 6. Withdraw Funds

```clarity
;; Withdraw after lock period expires
(contract-call? .savings-vault withdraw)
```

#### 7. Emergency Withdrawal

```clarity
;; Withdraw early with 10% penalty
(contract-call? .savings-vault emergency-withdraw)

;; Returns: {withdrawn: uint, penalty: uint}
```

#### 8. View Statistics

```clarity
;; Get your personal stats
(contract-call? .savings-vault get-user-stats tx-sender)

;; Returns:
;; {
;;   total-deposited: uint,
;;   total-withdrawn: uint,
;;   total-interest-earned: uint
;; }

;; Get contract-wide stats
(contract-call? .savings-vault get-contract-config)
(contract-call? .savings-vault get-tvl)
```

### Owner Functions

#### 1. Set Interest Rate

```clarity
;; Set annual interest rate (in basis points)
(contract-call? .savings-vault set-interest-rate u1000) ;; 10%
```

#### 2. Set Minimum Deposit

```clarity
;; Set minimum deposit (in microSTX)
(contract-call? .savings-vault set-minimum-deposit u500000) ;; 0.5 STX
```

#### 3. Pause/Unpause Contract

```clarity
;; Pause deposits (emergencies only)
(contract-call? .savings-vault pause-contract)

;; Resume operations
(contract-call? .savings-vault unpause-contract)
```

#### 4. Fund Contract

```clarity
;; Add STX for interest payments
(contract-call? .savings-vault fund-contract u100000000) ;; 100 STX
```

#### 5. Withdraw Excess

```clarity
;; Withdraw funds not allocated to user deposits
(contract-call? .savings-vault withdraw-excess)
```

## 🔐 Security Features

1. **Access Control**: Owner-only functions protected
2. **Balance Tracking**: Prevents withdrawal of user deposits
3. **Lock Period Enforcement**: Mandatory time-locks
4. **Emergency Penalty**: Discourages premature withdrawals
5. **Pause Mechanism**: Emergency stop capability
6. **Input Validation**: Comprehensive parameter checks

## 💡 Interest Calculation

Interest is calculated using the formula:

```
Interest = (Balance × Annual Rate × Blocks Elapsed) / (Basis Points × Blocks Per Year)
```

**Example**:
- Balance: 10 STX (10,000,000 microSTX)
- Annual Rate: 5% (500 basis points)
- Time: 7200 blocks (~50 days)

```
Interest = (10,000,000 × 500 × 7200) / (10,000 × 52,560)
Interest = 36,000,000,000,000 / 525,600,000
Interest ≈ 68,493 microSTX (0.068493 STX)
```

## 📊 Example Scenarios

### Scenario 1: Long-term Saver

```clarity
;; Alice deposits 100 STX for 1 year
(contract-call? .savings-vault deposit u100000000 u52560)

;; After 1 year (52560 blocks), with 5% APR:
;; Expected interest: ~5 STX
;; Total value: ~105 STX

;; Withdraw after lock period
(contract-call? .savings-vault withdraw)
```

### Scenario 2: Emergency Withdrawal

```clarity
;; Bob deposits 50 STX for 6 months
(contract-call? .savings-vault deposit u50000000 u25920)

;; After 1 month, needs funds urgently
(contract-call? .savings-vault emergency-withdraw)

;; Receives: 45 STX (50 - 10% penalty)
;; Penalty: 5 STX remains in contract
```

### Scenario 3: Multiple Deposits

```clarity
;; Carol makes multiple deposits
(contract-call? .savings-vault deposit u20000000 u4320)  ;; 20 STX, 30 days
(contract-call? .savings-vault deposit u30000000 u4320)  ;; 30 STX, 30 days

;; Total balance: 50 STX
;; Lock period resets with each deposit
```

## 🧪 Testing Examples

Run comprehensive tests:

```bash
# Test deployment
clarinet test --filter test-initial-config

# Test deposits
clarinet test --filter test-deposit-success
clarinet test --filter test-deposit-insufficient

# Test withdrawals
clarinet test --filter test-withdraw-before-lock
clarinet test --filter test-emergency-withdraw

# Test interest
clarinet test --filter test-interest-calculation

# Test admin functions
clarinet test --filter test-set-interest-rate
clarinet test --filter test-pause-contract

# Run all tests
clarinet test
```

## 📈 Gas Estimates

Approximate computational costs:

| Function | Estimated Cost | Notes |
|----------|----------------|-------|
| `deposit` | ~5,000 | First deposit higher |
| `withdraw` | ~4,000 | Includes interest claim |
| `claim-interest` | ~3,000 | |
| `emergency-withdraw` | ~4,000 | |
| `calculate-interest` | Read-only | No cost |
| Owner functions | ~2,000-3,000 | |

## 🔄 Integration Examples

### JavaScript/TypeScript (stacks.js)

```typescript
import { makeContractCall, broadcastTransaction } from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

// Deposit function
async function deposit(amount: number, lockPeriod: number) {
  const network = new StacksTestnet();
  
  const txOptions = {
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    contractName: 'savings-vault',
    functionName: 'deposit',
    functionArgs: [
      uintCV(amount),
      uintCV(lockPeriod)
    ],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);
  
  return broadcastResponse;
}

// Usage
await deposit(10000000, 1440); // 10 STX, 10 days
```

### React Hook Example

```typescript
import { useConnect } from '@stacks/connect-react';
import { uintCV } from '@stacks/transactions';

function useSavingsVault() {
  const { doContractCall } = useConnect();

  const deposit = async (amount: number, lockPeriod: number) => {
    await doContractCall({
      contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      contractName: 'savings-vault',
      functionName: 'deposit',
      functionArgs: [uintCV(amount), uintCV(lockPeriod)],
      onFinish: (data) => console.log('Transaction:', data.txId),
    });
  };

  return { deposit };
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Minimum not met" error**
   - Ensure deposit is ≥ minimum (default: 1 STX)

2. **"Invalid lock period" error**
   - Lock period must be 144-52560 blocks
   - 144 blocks ≈ 1 day

3. **"Lock period active" error**
   - Cannot withdraw before lock expires
   - Use `get-unlock-block` to check unlock time

4. **"Contract paused" error**
   - Owner has paused deposits
   - Wait for unpause or contact admin

## 📚 Additional Resources

- [Clarity Language Documentation](https://docs.stacks.co/clarity)
- [Clarinet Documentation](https://docs.hiro.so/clarinet)
- [Stacks.js Documentation](https://stacks.js.org/)
- [Stacks Explorer](https://explorer.stacks.co/)
- [Clarity Visual Studio Code Extension](https://marketplace.visualstudio.com/items?itemName=HiroSystems.clarity-lsp)

## 📝 License

MIT License

## ⚠️ Disclaimer

This smart contract is provided as-is for educational and development purposes. Always:
- Conduct thorough testing on testnet
- Get professional security audits before mainnet deployment
- Understand the risks of smart contracts
- Never deploy with real funds without proper testing

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📞 Support

For issues or questions:
- Review contract comments
- Check Clarity documentation
- Test on Stacks testnet first
- Join the Stacks community

---

**Built with ❤️ for the Stacks ecosystem**
