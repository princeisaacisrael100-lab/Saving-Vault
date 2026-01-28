import * as React from 'react';
import { useState, useEffect } from 'react';
import { useConnect } from '@stacks/connect-react';
import { userSession, network, authOptions, CONTRACT_ADDRESS, CONTRACT_NAME } from './stacks-config';
import { uintCV, standardPrincipalCV, cvToValue, PostConditionMode } from '@stacks/transactions';
import { callReadOnlyFunction } from '@stacks/transactions';

// No local constants here, using shared config from stacks-config.ts

interface UserSavings {
  balance: number;
  depositBlock: number;
  lockPeriod: number;
  lastInterestClaim: number;
}

interface ContractConfig {
  annualInterestRate: number;
  minimumDeposit: number;
  totalDeposits: number;
  contractPaused: boolean;
  totalInterestPaid: number;
  contractBalance: number;
}

export const SavingsVault: React.FC = () => {
  const { doContractCall, authenticate } = useConnect();
  const [userAddress, setUserAddress] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [savings, setSavings] = useState<UserSavings | null>(null);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [pendingInterest, setPendingInterest] = useState<number>(0);
  const [canWithdrawNow, setCanWithdrawNow] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Check login status on mount and when app focuses
  useEffect(() => {
    const checkLogin = () => {
      if (userSession.isUserSignedIn()) {
        const data = userSession.loadUserData();
        setUserData(data);

        // Try various address formats provided by different wallets
        const testnetAddr = data.profile?.stxAddress?.testnet;
        const mainnetAddr = data.profile?.stxAddress?.mainnet;
        const fallbackAddr = data.profile?.stxAddress;

        const address = testnetAddr || mainnetAddr || (typeof fallbackAddr === 'string' ? fallbackAddr : '');

        if (address) {
          setUserAddress(address);
        }
      } else if (userSession.isSignInPending()) {
        userSession.handlePendingSignIn().then((data) => {
          setUserData(data);
          const address = data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet;
          if (address) setUserAddress(address);
        });
      }
    };

    checkLogin();
    window.addEventListener('focus', checkLogin);
    return () => window.removeEventListener('focus', checkLogin);
  }, []);

  // Form states
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [lockDays, setLockDays] = useState<string>('30');

  // Helper functions
  const stxToMicroStx = (stx: number): number => stx * 1_000_000;
  const microStxToStx = (microStx: number): number => microStx / 1_000_000;
  const daysToBlocks = (days: number): number => Math.floor(days * 144);
  const blocksToDays = (blocks: number): number => Math.floor(blocks / 144);

  // Load user data
  useEffect(() => {
    if (userAddress) {
      loadUserData();
      const interval = setInterval(loadUserData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [userAddress]);

  const loadUserData = async () => {
    if (!userAddress) return;
    setRefreshing(true);

    try {
      // Get user savings
      const savingsResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-user-savings',
        functionArgs: [standardPrincipalCV(userAddress)],
        network,
        senderAddress: userAddress,
      });
      const savingsVal = cvToValue(savingsResult);

      if (savingsVal && savingsVal.value) {
        setSavings({
          balance: Number(savingsVal.value.balance.value),
          depositBlock: Number(savingsVal.value['deposit-block'].value),
          lockPeriod: Number(savingsVal.value['lock-period'].value),
          lastInterestClaim: Number(savingsVal.value['last-interest-claim'].value),
        });
      } else {
        setSavings(null);
      }

      // Get contract config
      const configResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-contract-config',
        functionArgs: [],
        network,
        senderAddress: userAddress,
      });
      const configVal = cvToValue(configResult);

      setConfig({
        annualInterestRate: Number(configVal.value['annual-interest-rate'].value),
        minimumDeposit: Number(configVal.value['minimum-deposit'].value),
        totalDeposits: Number(configVal.value['total-deposits'].value),
        contractPaused: configVal.value['contract-paused'].value,
        totalInterestPaid: Number(configVal.value['total-interest-paid'].value),
        contractBalance: Number(configVal.value['contract-balance'].value),
      });

      // Get pending interest
      const interestResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'calculate-interest',
        functionArgs: [standardPrincipalCV(userAddress)],
        network,
        senderAddress: userAddress,
      });
      setPendingInterest(Number(cvToValue(interestResult).value));

      // Get withdrawal status
      const withdrawResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'can-withdraw',
        functionArgs: [standardPrincipalCV(userAddress)],
        network,
        senderAddress: userAddress,
      });
      setCanWithdrawNow(cvToValue(withdrawResult).value);

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Deposit function
  const handleDeposit = async () => {
    if (!depositAmount || !lockDays) {
      alert('Please enter deposit amount and lock period');
      return;
    }

    setLoading(true);
    try {
      const amount = stxToMicroStx(parseFloat(depositAmount));
      const lockPeriod = daysToBlocks(parseInt(lockDays));

      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'deposit',
        functionArgs: [uintCV(amount)],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Deposit transaction:', data.txId);
          alert(`Deposit broadcasted! Transaction ID: ${data.txId}`);
          setDepositAmount('');
          // Data will refresh via interval or manual reload
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Deposit failed: ' + error);
      setLoading(false);
    }
  };

  // Withdraw function
  const handleWithdraw = async () => {
    if (!canWithdrawNow) {
      alert('Lock period has not expired yet');
      return;
    }

    setLoading(true);
    try {
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'withdraw',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Withdrawal transaction:', data.txId);
          alert(`Withdrawal broadcasted! Transaction ID: ${data.txId}`);
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Withdrawal error:', error);
      alert('Withdrawal failed: ' + error);
      setLoading(false);
    }
  };

  // Emergency withdraw function
  const handleEmergencyWithdraw = async () => {
    const confirmed = window.confirm(
      'Emergency withdrawal will incur a 10% penalty and you will lose pending interest. Are you sure?'
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'emergency-withdraw',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Emergency withdrawal transaction:', data.txId);
          alert(`Emergency withdrawal broadcasted! Transaction ID: ${data.txId}`);
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Emergency withdrawal error:', error);
      alert('Emergency withdrawal failed: ' + error);
      setLoading(false);
    }
  };

  // Claim interest function
  const handleClaimInterest = async () => {
    if (pendingInterest === 0) {
      alert('No interest to claim');
      return;
    }

    setLoading(true);
    try {
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'claim-interest',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Claim interest transaction:', data.txId);
          alert(`Interest claim broadcasted! Transaction ID: ${data.txId}`);
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Claim interest error:', error);
      alert('Claim interest failed: ' + error);
      setLoading(false);
    }
  };

  return (
    <div className="vault-app">
      <header className="app-header">
        <h1>SavingsVault</h1>
        {refreshing && <span className="refresh-loader">Refreshing...</span>}
      </header>

      <main className="app-content">
        {/* Connection Section */}
        <section className="card connection-card">
          <h2>Wallet Connection</h2>
          {userData ? (
            <div className="user-info">
              <p>Connected as: <strong>{userAddress}</strong></p>
              <button
                className="claim-btn"
                onClick={() => {
                  userSession.signUserOut();
                  window.location.reload();
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="auth-actions">
              <p>Connect your Stacks wallet to manage your savings vault.</p>
              <button className="primary-btn" onClick={() => authenticate(authOptions)}>
                Connect Wallet
              </button>
              <div className="manual-entry" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>OR ENTER ADDRESS MANUALLY</label>
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Stacks Address (e.g. ST1P...)"
                    value={userAddress}
                    onChange={(e) => setUserAddress(e.target.value)}
                  />
                  <button
                    className="primary-btn"
                    onClick={loadUserData}
                    disabled={!userAddress || loading}
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="dashboard-grid">
          {/* Account Overview */}
          <section className="card stats-card">
            <h2>Your Savings</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <label>Principal</label>
                <span className="value">{savings ? microStxToStx(savings.balance).toFixed(2) : '0.00'} STX</span>
              </div>
              <div className="stat-item">
                <label>Lock Period</label>
                <span className="value">{savings ? blocksToDays(savings.lockPeriod) : '0'} Days</span>
              </div>
              <div className="stat-item">
                <label>Pending Interest</label>
                <span className="value highlight">{microStxToStx(pendingInterest).toFixed(6)} STX</span>
              </div>
              <div className="stat-item">
                <label>Unlocked</label>
                <span className={`value ${canWithdrawNow ? 'success' : 'pending'}`}>
                  {canWithdrawNow ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="claim-btn"
                onClick={handleClaimInterest}
                disabled={loading || pendingInterest === 0}
              >
                Claim Interest
              </button>
              <button
                className="withdraw-btn"
                onClick={handleWithdraw}
                disabled={loading || !canWithdrawNow || !savings || savings.balance === 0}
              >
                Withdraw
              </button>
            </div>
          </section>

          {/* Deposit Section */}
          <section className="card deposit-card">
            <h2>New Deposit (STX)</h2>
            <div className="form-group">
              <label>Amount (in STX Tokens)</label>
              <input
                type="number"
                placeholder="e.g. 10 STX"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="1"
              />
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                Note: This vault uses STX tokens. $100 USD would be approx. {Math.round(100 / 0.6)} STX.
              </p>
            </div>
            <div className="form-group">
              <label>Lock Duration</label>
              <select
                value={lockDays}
                onChange={(e) => setLockDays(e.target.value)}
              >
                <option value="1">1 Day</option>
                <option value="7">1 Week</option>
                <option value="30">1 Month</option>
                <option value="90">3 Months</option>
                <option value="180">6 Months</option>
                <option value="365">1 Year</option>
              </select>
            </div>
            <button
              className="deposit-btn"
              onClick={handleDeposit}
              disabled={loading || !depositAmount}
            >
              {loading ? 'Processing...' : 'Deposit Funds'}
            </button>
          </section>
        </div>

        {/* Emergency Section */}
        {savings && savings.balance > 0 && (
          <section className="card emergency-card">
            <div className="emergency-header">
              <h2>Emergency Action</h2>
              <span className="warning-badge">10% Penalty</span>
            </div>
            <p>Access your principal immediately. This will incur a 10% penalty fee and forfeit all pending interest.</p>
            <button
              className="danger-btn"
              onClick={handleEmergencyWithdraw}
              disabled={loading}
            >
              Emergency Withdrawal
            </button>
          </section>
        )}

        {/* Contract Info */}
        {config && (
          <section className="card info-card">
            <h2>Protocol Stats</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Current APR</label>
                <span>{config.annualInterestRate / 100}%</span>
              </div>
              <div className="info-item">
                <label>Min. Deposit</label>
                <span>{microStxToStx(config.minimumDeposit)} STX</span>
              </div>
              <div className="info-item">
                <label>Total Value Locked</label>
                <span>{microStxToStx(config.totalDeposits).toLocaleString()} STX</span>
              </div>
              <div className="info-item">
                <label>Status</label>
                <span className={config.contractPaused ? 'warning' : 'success'}>
                  {config.contractPaused ? 'Paused' : 'Active'}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>

      <style>{`
        .vault-app {
          max-width: 900px;
          margin: 0 auto;
          color: #f8fafc;
          text-align: left;
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .app-header h1 {
          font-size: 2.5rem;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .refresh-loader {
          font-size: 0.875rem;
          color: #94a3b8;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .card {
          background: #1e293b;
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px solid #334155;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .card:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }

        .card h2 {
          margin-top: 0;
          font-size: 1.25rem;
          color: #e2e8f0;
          margin-bottom: 1.25rem;
        }

        .input-group {
          display: flex;
          gap: 0.75rem;
        }

        input, select {
          flex: 1;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 1rem;
          outline: none;
        }

        input:focus {
          border-color: #6366f1;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .stats-grid, .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .stat-item label, .info-item label, .form-group label {
          display: block;
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .stat-item .value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .stat-item .value.highlight {
          color: #818cf8;
        }

        .value.success { color: #4ade80; }
        .value.pending { color: #fbbf24; }

        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .primary-btn, .deposit-btn, .claim-btn, .withdraw-btn, .danger-btn {
          width: 100%;
          border: none;
          font-weight: 600;
          padding: 0.75rem;
          border-radius: 8px;
          transition: filter 0.2s;
        }

        .primary-btn { background: #6366f1; color: white; width: auto; min-width: 100px; }
        .deposit-btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; margin-top: 1rem; }
        .claim-btn { background: #334155; color: #e2e8f0; border: 1px solid #475569; }
        .withdraw-btn { background: #818cf8; color: white; }
        .danger-btn { background: #ef4444; color: white; }

        .form-group { margin-bottom: 1rem; }

        .emergency-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .warning-badge {
          background: #7f1d1d;
          color: #fecaca;
          font-size: 0.75rem;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          font-weight: 600;
        }

        .emergency-card p {
          color: #94a3b8;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        .info-item span {
          font-size: 1.125rem;
          font-weight: 600;
        }

        .info-item span.success { color: #4ade80; }
        .info-item span.warning { color: #f87171; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }

        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default SavingsVault;

