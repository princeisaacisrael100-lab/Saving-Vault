import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConnect } from '@stacks/connect-react';
import { userSession, authOptions, network, CONTRACT_ADDRESS, CONTRACT_NAME } from './stacks-config';
import { LayoutDashboard, Home, LogIn, LogOut, Sun, Moon, ShieldCheck, Wallet } from 'lucide-react';
import { callReadOnlyFunction } from '@stacks/transactions';
import { standardPrincipalCV, cvToValue } from '@stacks/transactions';

const Navbar: React.FC = () => {
    const { authenticate } = useConnect();
    const location = useLocation();
    const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('vault-theme');
        return (saved as 'light' | 'dark') || 'dark';
    });
    const [isSignedIn, setIsSignedIn] = React.useState(userSession.isUserSignedIn());
    const [balance, setBalance] = React.useState<number>(0);
    const [userAddress, setUserAddress] = React.useState<string>('');

    React.useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('vault-theme', theme);
    }, [theme]);

    // Check auth status and load balance
    React.useEffect(() => {
        const checkAuth = async () => {
            const signedIn = userSession.isUserSignedIn();
            setIsSignedIn(signedIn);

            if (signedIn) {
                const data = userSession.loadUserData();
                const address = data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet || data.profile?.stxAddress;
                if (address) {
                    setUserAddress(address);
                    await loadBalance(address);
                }
            }
        };
        checkAuth();
        const interval = setInterval(checkAuth, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const loadBalance = async (address: string) => {
        try {
            const savingsResult = await callReadOnlyFunction({
                contractAddress: CONTRACT_ADDRESS,
                contractName: CONTRACT_NAME,
                functionName: 'get-user-savings',
                functionArgs: [standardPrincipalCV(address)],
                network,
                senderAddress: address,
            });
            const savingsVal = cvToValue(savingsResult);
            if (savingsVal && savingsVal.value) {
                setBalance(Number(savingsVal.value.balance.value) / 1_000_000);
            }
        } catch (error) {
            console.error('Error loading balance:', error);
        }
    };

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    const handleAuth = () => {
        if (isSignedIn) {
            userSession.signUserOut();
            window.location.href = '/';
        } else {
            authenticate(authOptions);
        }
    };

    return (
        <nav className="navbar glass">
            <div className="nav-container">
                <Link to="/" className="nav-logo">
                    <div className="logo-icon">
                        <ShieldCheck size={28} />
                    </div>
                    <span>SavingsVault</span>
                </Link>

                <div className="nav-links">
                    <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                        <Home size={18} />
                        <span>Home</span>
                    </Link>
                    {isSignedIn && (
                        <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
                            <LayoutDashboard size={18} />
                            <span>Dashboard</span>
                        </Link>
                    )}
                </div>

                {isSignedIn && balance > 0 && (
                    <div className="nav-balance">
                        <Wallet size={16} />
                        <span className="balance-amount">{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} STX</span>
                    </div>
                )}

                <div className="nav-actions">
                    <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>

                    <button
                        className={`auth-btn ${isSignedIn ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={handleAuth}
                    >
                        {isSignedIn ? (
                            <>
                                <LogOut size={18} />
                                <span>Sign Out</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={18} />
                                <span>Connect Wallet</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: var(--nav-height);
          z-index: 1000;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
        }

        .nav-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          padding: 0 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: var(--text-primary);
          font-weight: 800;
          font-size: 1.25rem;
          letter-spacing: -0.025em;
        }

        .logo-icon {
          background: var(--accent-gradient);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          color: var(--text-secondary);
          font-weight: 500;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .nav-link:hover {
          color: var(--text-primary);
          background: var(--border-color);
        }

        .nav-link.active {
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.1);
        }

        .nav-balance {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 12px;
          font-weight: 600;
          color: var(--accent-primary);
          font-size: 0.875rem;
        }

        .balance-amount {
          font-family: 'Courier New', monospace;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .theme-toggle-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          width: 40px;
          height: 40px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }

        .theme-toggle-btn:hover {
          background: var(--border-color);
          border-color: var(--text-muted);
        }

        .auth-btn {
          height: 40px;
          font-size: 0.875rem;
          padding: 0 1.25rem;
        }

        @media (max-width: 640px) {
          .nav-link span {
            display: none;
          }
          .auth-btn span {
            display: none;
          }
          .nav-logo span {
            display: none;
          }
        }
      `}</style>
        </nav>
    );
};

export default Navbar;
