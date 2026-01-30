import * as React from 'react';
import { useState, useEffect } from 'react';
import { useConnect } from '@stacks/connect-react';
import { userSession, network, authOptions, CONTRACT_ADDRESS, CONTRACT_NAME } from './stacks-config';
import { uintCV, standardPrincipalCV, cvToValue, PostConditionMode } from '@stacks/transactions';
import { callReadOnlyFunction } from '@stacks/transactions';
import {
  Wallet,
  TrendingUp,
  Lock,
  Clock,
  AlertTriangle,
  Info,
  RefreshCcw,
  ChevronRight,
  ShieldCheck,
  Coins,
  LogOut
} from 'lucide-react';

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
  const connectResults = useConnect();
  const doContractCall = connectResults?.doContractCall;
  const [userAddress, setUserAddress] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [savings, setSavings] = useState<UserSavings | null>(null);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [pendingInterest, setPendingInterest] = useState<number>(0);
  const [canWithdrawNow, setCanWithdrawNow] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Check login status
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData();
      setUserData(data);
      const address = data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet || data.profile?.stxAddress;

      // STRICT NETWORK CHECK
      // If address starts with 'SP' it is Mainnet. We are on Testnet.
      // We must sign them out to clear the stale session.
      if (address && address.startsWith('SP')) {
        alert('Validation Failed: You are signed in with a Mainnet account.\n\nWe are automatically signing you out.\n\nPlease sign in again and ensure "Testnet" is selected in your wallet.');
        userSession.signUserOut();
        window.location.reload();
        return;
      }

      if (address) setUserAddress(address);
    }
  }, []);

  // Form states
  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string, txId?: string } | null>(null);

  // Form states
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [lockDays, setLockDays] = useState<string>('30');

  // Helper functions
  const stxToMicroStx = (stx: number): number => stx * 1_000_000;
  const microStxToStx = (microStx: number): number => microStx / 1_000_000;
  const daysToBlocks = (days: number): number => Math.floor(days * 144);
  const blocksToDays = (blocks: number): number => Math.floor(blocks / 144);

  // Helper to safely parse Clarity Values recursively (handles Responses, Optionals, and Tuples)
  const safeParse = (cv: any): any => {
    if (!cv) return null;

    // ResponseOk = 7, ResponseErr = 8
    if (cv.type === 7) return safeParse(cv.value);
    if (cv.type === 8) return null;

    // OptionalSome = 10, OptionalNone = 9
    if (cv.type === 10) return safeParse(cv.value);
    if (cv.type === 9) return null;

    // Tuple = 12
    if (cv.type === 12) {
      const data: any = {};
      for (const key in cv.data) {
        data[key] = safeParse(cv.data[key]);
      }
      return data;
    }

    // Default for leaf types (uint, principal, bool, etc.)
    return cvToValue(cv);
  };

  const loadUserData = async () => {
    if (!userAddress) return;
    setRefreshing(true);

    try {
      // 1. Get user savings
      const vaultResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-user-savings',
        functionArgs: [standardPrincipalCV(userAddress)],
        network,
        senderAddress: userAddress,
      });

      const vaultVal = safeParse(vaultResult);

      if (vaultVal) {
        // Now vaultVal should be a plain JS object
        const balance = Number(vaultVal.balance);
        const depositBlock = Number(vaultVal['deposit-block']);
        const lockPeriod = Number(vaultVal['lock-period']);

        setSavings({
          balance,
          depositBlock,
          lockPeriod,
          lastInterestClaim: Number(vaultVal['last-interest-claim']),
        });

        // 'can-withdraw' helper was removed from contract.
        // We set it to true to enable the button; contract will enforce lock.
        setCanWithdrawNow(true);

        // Calculate pending interest
        const interestResult = await callReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'calculate-interest',
          functionArgs: [standardPrincipalCV(userAddress)],
          network,
          senderAddress: userAddress,
        });
        setPendingInterest(Number(safeParse(interestResult) || 0));

      } else {
        setSavings(null);
        setCanWithdrawNow(false);
        setPendingInterest(0);
      }

      // 2. Get contract config
      const configResult = await callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-contract-info',
        functionArgs: [],
        network,
        senderAddress: userAddress,
      });

      const configVal = safeParse(configResult);
      if (configVal) {
        setConfig({
          annualInterestRate: Number(configVal['annual-interest-rate'] || 0),
          minimumDeposit: Number(configVal['minimum-deposit'] || 0),
          totalDeposits: Number(configVal['total-deposits'] || 0),
          contractPaused: Boolean(configVal['contract-paused']),
          totalInterestPaid: Number(configVal['total-interest-paid'] || 0),
          contractBalance: 0,
        });
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeposit = async () => {
    setNotification(null);
    if (!depositAmount || !lockDays) {
      setNotification({ type: 'error', message: 'Please enter deposit amount and lock period' });
      return;
    }

    const minAmount = config ? microStxToStx(config.minimumDeposit) : 1;
    if (parseFloat(depositAmount) < minAmount) {
      setNotification({ type: 'error', message: `Minimum deposit is ${minAmount} STX` });
      return;
    }

    setLoading(true);
    try {
      const amount = stxToMicroStx(parseFloat(depositAmount));
      const lockPeriod = daysToBlocks(parseInt(lockDays));

      await doContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'deposit',
        functionArgs: [uintCV(amount), uintCV(lockPeriod)],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setNotification({
            type: 'success',
            message: 'Deposit transaction sent! Validation takes ~1-3 mins.',
            txId: data.txId
          });
          setDepositAmount('');
          setLoading(false);
          // Poll for updates
          let attempts = 0;
          const pollInterval = setInterval(() => {
            loadUserData();
            attempts++;
            if (attempts >= 12) clearInterval(pollInterval);
          }, 10000);
          setTimeout(() => loadUserData(), 5000);
        },
        onCancel: () => setLoading(false),
      });
    } catch (error) {
      console.error('Deposit error:', error);
      setNotification({ type: 'error', message: 'Deposit failed: ' + error });
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setNotification(null);
    if (!canWithdrawNow) {
      setNotification({ type: 'error', message: 'Lock period has not expired yet' });
      return;
    }

    setLoading(true);
    try {
      await doContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'withdraw',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setNotification({
            type: 'success',
            message: 'Withdrawal transaction sent!',
            txId: data.txId
          });
          setLoading(false);
          setTimeout(() => loadUserData(), 5000);
          let attempts = 0;
          const pollInterval = setInterval(() => {
            loadUserData();
            attempts++;
            if (attempts >= 12) clearInterval(pollInterval);
          }, 10000);
        },
        onCancel: () => setLoading(false),
      });
    } catch (error) {
      console.error('Withdrawal error:', error);
      setNotification({ type: 'error', message: 'Withdrawal failed: ' + error });
      setLoading(false);
    }
  };

  const handleEmergencyWithdraw = async () => {
    setLoading(true);
    setNotification(null);
    try {
      await doContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'emergency-withdraw',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setNotification({
            type: 'success',
            message: 'Emergency Withdrawal sent!',
            txId: data.txId
          });
          setLoading(false);
          setTimeout(() => loadUserData(), 5000);
        },
        onCancel: () => setLoading(false),
      });
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed: ' + err });
      setLoading(false);
    }
  };

  const handleClaimInterest = async () => {
    setLoading(true);
    setNotification(null);
    try {
      await doContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'claim-interest',
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setNotification({
            type: 'success',
            message: 'Interest Claim sent!',
            txId: data.txId
          });
          setLoading(false);
          setTimeout(() => loadUserData(), 5000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Failed: ' + err });
      setLoading(false);
    }
  };

  return (
    <div className="vault-dashboard animate-fade-in">
      <div className="dashboard-container">
        {notification && (
          <div className={`notification-banner ${notification.type} animate-fade-in`}>
            {notification.type === 'success' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            <div className="notification-content">
              <span className="msg">{notification.message}</span>
              {notification.txId && (
                <a
                  href={`https://explorer.hiro.so/txid/${notification.txId}?chain=testnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-link"
                >
                  View Transaction <ChevronRight size={12} />
                </a>
              )}
            </div>
            <button className="close-btn" onClick={() => setNotification(null)}>×</button>
          </div>
        )}

        <div className="network-banner">
          <AlertTriangle size={16} />
          <span>Running on <strong>Stacks Testnet</strong>. Please ensure your wallet (Xverse/Leather) is set to Testnet.</span>
        </div>
        <header className="dashboard-header">
          <div className="title-section">
            <ShieldCheck size={32} className="accent-icon" />
            <div>
              <h1>Protocol Dashboard</h1>
              <p>Manage your savings and earn interest</p>
            </div>
          </div>
          <div className="header-status">
            {refreshing && (
              <div className="refreshing-indicator">
                <RefreshCcw size={16} className="spin" />
                <span>Syncing...</span>
              </div>
            )}
            <div className="address-badge">
              <Wallet size={16} />
              <span>{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
            </div>
            <button
              className="refresh-btn"
              onClick={() => {
                userSession.signUserOut();
                window.location.reload();
              }}
              title="Sign Out"
              style={{ width: 'auto', padding: '0 0.75rem', gap: '0.5rem' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* Main Stats */}
          <section className="card stats-card">
            <div className="card-header">
              <div className="card-title">
                <TrendingUp size={20} className="accent-icon" />
                <h2>Your Savings</h2>
              </div>
              <button
                className="refresh-btn"
                onClick={() => loadUserData()}
                disabled={refreshing}
                title="Refresh balance"
              >
                <RefreshCcw size={16} className={refreshing ? 'spin' : ''} />
              </button>
            </div>

            <div className="main-stat">
              <label>Total Balance</label>
              <div className="stx-value">
                <Coins size={32} />
                <span>{savings ? microStxToStx(savings.balance).toLocaleString() : '0.00'}</span>
                <span className="unit">STX</span>
              </div>
            </div>

            <div className="stats-subgrid">
              <div className="stat-box">
                <label><Lock size={12} /> Lock Period</label>
                <span className="val">{savings ? blocksToDays(savings.lockPeriod) : '0'} Days</span>
              </div>
              <div className="stat-box">
                <label><Clock size={12} /> Unlocked</label>
                <span className={`val ${canWithdrawNow ? 'status-success' : 'status-pending'}`}>
                  {canWithdrawNow ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className="interest-panel">
              <div className="interest-info">
                <label>Pending Interest</label>
                <div className="interest-value">
                  {microStxToStx(pendingInterest).toFixed(6)} STX
                </div>
              </div>
              <button
                className="btn-primary claim-btn"
                onClick={handleClaimInterest}
                disabled={loading || pendingInterest === 0}
              >
                Claim Rewards <ChevronRight size={16} />
              </button>
            </div>

            <button
              className="btn-outline withdraw-btn"
              onClick={handleWithdraw}
              disabled={loading || !canWithdrawNow || !savings || savings.balance === 0}
            >
              Withdraw Principal
            </button>
          </section>

          {/* Action Card */}
          <section className="card deposit-card" id="save-funds-section">
            <div className="card-header">
              <div className="card-title">
                <Coins size={20} className="accent-icon" />
                <h2>Save Funds (Deposit)</h2>
              </div>
            </div>

            <div className="form-content">
              <div className="input-field">
                <label>Amount to Save (STX)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min={config ? microStxToStx(config.minimumDeposit) : 1}
                />
              </div>

              <div className="input-field">
                <label>Lock Duration</label>
                <select value={lockDays} onChange={(e) => setLockDays(e.target.value)}>
                  <option value="1">1 Day (Quick Test)</option>
                  <option value="7">1 Week</option>
                  <option value="30">1 Month</option>
                  <option value="90">3 Months</option>
                  <option value="180">6 Months</option>
                  <option value="365">1 Year</option>
                </select>
              </div>

              <div className="deposit-info">
                <Info size={14} />
                <p>Your funds will be locked in the contract for the chosen duration to earn interest. Early withdrawal incurs a 10% penalty.</p>
              </div>

              <button
                className="btn-primary submit-deposit"
                onClick={handleDeposit}
                disabled={loading || !depositAmount}
              >
                {loading ? 'Processing...' : 'Save Funds Now'}
              </button>
            </div>
          </section>
        </div>

        {/* Bottom Section */}
        <div className="secondary-grid">
          {/* Protocol Info */}
          {config && (
            <section className="card protocol-card">
              <div className="card-header">
                <h2>Protocol Status</h2>
              </div>
              <div className="info-list">
                <div className="info-row">
                  <label>Annual Interest Rate</label>
                  <span className="status-success">{config.annualInterestRate / 100}% APR</span>
                </div>
                <div className="info-row">
                  <label>Minimum Deposit</label>
                  <span>{microStxToStx(config.minimumDeposit)} STX</span>
                </div>
                <div className="info-row">
                  <label>Total Value Locked</label>
                  <span>{microStxToStx(config.totalDeposits).toLocaleString()} STX</span>
                </div>
                <div className="info-row">
                  <label>Contract Status</label>
                  <span className={config.contractPaused ? 'status-danger' : 'status-success'}>
                    {config.contractPaused ? 'Paused' : 'Active'}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Emergency Area */}
          {savings && savings.balance > 0 && (
            <section className="card emergency-card danger-zone">
              <div className="card-header">
                <div className="card-title">
                  <AlertTriangle size={20} className="danger-icon" />
                  <h2>Emergency Actions</h2>
                </div>
              </div>
              <p>Need access to your funds before the lock period expires?</p>
              <div className="danger-box">
                <p>A <strong>10% penalty</strong> fee will be applied to your principal. All pending interest will be forfeited.</p>
                <button
                  className="danger-btn"
                  onClick={handleEmergencyWithdraw}
                  disabled={loading}
                >
                  Emergency Withdraw
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        .vault-dashboard {
          padding-top: calc(var(--nav-height) + 2rem);
          padding-bottom: 4rem;
          min-height: 100vh;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent),
                      radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.05), transparent);
        }

        .dashboard-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        .notification-banner {
          position: fixed;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          width: 90%;
          max-width: 600px;
          animation: slideDown 0.3s ease-out;
        }

        .notification-banner.success {
          background: #10b981;
          color: white;
        }

        .notification-banner.error {
          background: #ef4444;
          color: white;
        }

        .notification-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .notification-content .msg {
          font-weight: 600;
        }

        .tx-link {
          color: rgba(255, 255, 255, 0.9);
          text-decoration: underline;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .tx-link:hover {
          color: white;
        }

        .close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.25rem;
          line-height: 1;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }

        .network-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: var(--warning);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 3rem;
        }

        .title-section h1 {
          font-size: 2rem;
          font-weight: 800;
          margin: 0 0 0.25rem 0;
          letter-spacing: -0.02em;
        }

        .title-section p {
          color: var(--text-secondary);
          margin: 0;
        }

        .header-status {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .refreshing-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .address-badge {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          padding: 0.5rem 1rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-family: monospace;
          color: var(--text-secondary);
        }

        .card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 2rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card:hover {
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.3);
        }

        .card-header {
          margin-bottom: 2rem;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .card-title h2 {
          font-size: 1.25rem;
          margin: 0;
          font-weight: 700;
        }

        .refresh-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-btn:hover:not(:disabled) {
          background: var(--border-color);
          color: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .main-stat {
          margin-bottom: 2rem;
        }

        .main-stat label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 0.5rem;
        }

        .stx-value {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 3rem;
          font-weight: 800;
          line-height: 1;
        }

        .stx-value .unit {
          font-size: 1rem;
          color: var(--text-muted);
          font-weight: 600;
          align-self: flex-end;
          margin-bottom: 0.5rem;
        }

        .stats-subgrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-box {
          background: var(--bg-input);
          padding: 1rem;
          border-radius: 16px;
          border: 1px solid var(--border-color);
        }

        .stat-box label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.4rem;
        }

        .stat-box .val {
          font-size: 1.125rem;
          font-weight: 700;
        }

        .interest-panel {
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 16px;
          padding: 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .interest-info label {
          font-size: 0.75rem;
          color: var(--text-muted);
          display: block;
          margin-bottom: 0.25rem;
        }

        .interest-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--accent-primary);
        }

        .claim-btn {
          padding: 0.6rem 1rem;
          font-size: 0.875rem;
        }

        .withdraw-btn {
          width: 100%;
          justify-content: center;
        }

        /* Form */
        .form-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .input-field label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        input, select {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem;
          color: var(--text-primary);
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.2s;
        }

        input:focus, select:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .deposit-info {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(245, 158, 11, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(245, 158, 11, 0.1);
          color: var(--warning);
          font-size: 0.875rem;
          line-height: 1.4;
        }

        .deposit-info p { margin: 0; }

        .submit-deposit {
          width: 100%;
          padding: 1rem;
        }

        /* Secondary Grid */
        .secondary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .info-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .info-row label {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .info-row span {
          font-weight: 600;
        }

        /* Emergency */
        .danger-zone {
          border-color: rgba(239, 68, 68, 0.2);
        }

        .danger-zone:hover {
          border-color: rgba(239, 68, 68, 0.4);
        }

        .danger-icon {
          color: var(--danger);
        }

        .danger-box {
          background: rgba(239, 68, 68, 0.05);
          padding: 1.5rem;
          border-radius: 16px;
          border: 1px solid rgba(239, 68, 68, 0.1);
          margin-top: 1rem;
        }

        .danger-btn {
          background: var(--danger);
          color: white;
          width: 100%;
          margin-top: 1rem;
          font-weight: 700;
        }

        .danger-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-2px);
        }

        .status-success { color: var(--success); }
        .status-pending { color: var(--warning); }
        .status-danger { color: var(--danger); }

        @media (max-width: 868px) {
          .dashboard-grid, .secondary-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SavingsVault;

