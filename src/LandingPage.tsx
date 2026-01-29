import * as React from 'react';
import { useConnect } from '@stacks/connect-react';
import { authOptions, userSession } from './stacks-config';
import { Shield, Zap, BarChart3, ArrowRight, Lock, Repeat, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
    const { authenticate } = useConnect();
    const navigate = useNavigate();
    const [isSignedIn, setIsSignedIn] = React.useState(userSession.isUserSignedIn());

    React.useEffect(() => {
        const checkAuth = () => {
            setIsSignedIn(userSession.isUserSignedIn());
        };
        checkAuth();
        window.addEventListener('focus', checkAuth);
        return () => window.removeEventListener('focus', checkAuth);
    }, []);

    const handleGetStarted = () => {
        if (isSignedIn) {
            navigate('/dashboard');
        } else {
            authenticate(authOptions);
        }
    };

    return (
        <div className="landing-page">
            {/* Hero Section */}
            <header className="hero">
                <div className="container">
                    <div className="hero-content animate-fade-in">
                        <div className="badge">
                            <span className="badge-dot"></span>
                            Secure Stacks Protocol
                        </div>
                        <h1>Secure Your Future with <span className="gradient-text">SavingsVault</span></h1>
                        <p className="hero-description">
                            The premier decentralized savings protocol on Stacks. Earn high-yield interest on your STX
                            with enterprise-grade security and full transparency.
                        </p>
                        <div className="hero-actions">
                            <button className="btn-primary btn-lg" onClick={handleGetStarted}>
                                Get Started
                                <ArrowRight size={20} />
                            </button>
                            <button className="btn-secondary btn-lg">
                                View Protocol
                            </button>
                        </div>

                        <div className="hero-stats">
                            <div className="stat">
                                <span className="stat-value">12.5%</span>
                                <span className="stat-label">Target APR</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">$2.4M</span>
                                <span className="stat-label">Total Locked</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">15k+</span>
                                <span className="stat-label">Active Users</span>
                            </div>
                        </div>
                    </div>

                    <div className="hero-visual animate-float">
                        <div className="visual-card glass">
                            <div className="card-header">
                                <Shield className="accent-icon" size={32} />
                                <div className="card-header-text">
                                    <h3>Active Security</h3>
                                    <span>Protocol Shield Enabled</span>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="progress-bar">
                                    <div className="progress-fill"></div>
                                </div>
                                <div className="card-footer">
                                    <span>Audited by Clarity Group</span>
                                    <div className="status-indicator">Online</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Features Section */}
            <section className="features">
                <div className="container">
                    <div className="section-header">
                        <h2>Why choose SavingsVault?</h2>
                        <p>Our protocol is built from the ground up to provide the best-in-class savings experience.</p>
                    </div>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">
                                <Zap size={24} />
                            </div>
                            <h3>Instant Deposits</h3>
                            <p>Move your STK into the vault instantly and start earning interest from the first block.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon">
                                <Lock size={24} />
                            </div>
                            <h3>Flexible Locking</h3>
                            <p>Choose from multiple lock periods tailored to your financial goals and risk appetite.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon">
                                <BarChart3 size={24} />
                            </div>
                            <h3>Real-time APR</h3>
                            <p>Watch your savings grow with our transparent and dynamic interest rate calculations.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon">
                                <Repeat size={24} />
                            </div>
                            <h3>Auto-Compounding</h3>
                            <p>Optionally re-stake your interest automatically to maximize your long-term growth.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon">
                                <Shield size={24} />
                            </div>
                            <h3>Audited Contracts</h3>
                            <p>Rest easy knowing your funds are protected by rigorously tested and audited Clarity contracts.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon">
                                <Globe size={24} />
                            </div>
                            <h3>Global Access</h3>
                            <p>Participate in the decentralized future of finance from anywhere in the world.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-card glass">
                        <h2>Ready to start saving?</h2>
                        <p>Connect with Xverse, Leather, or any Stacks wallet to begin earning.</p>
                        <button className="btn-primary btn-lg" onClick={handleGetStarted}>
                            {isSignedIn ? 'Go to Dashboard' : 'Connect Wallet'}
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="container">
                    <p>&copy; 2026 SavingsVault Protocol. Built on Stacks.</p>
                </div>
            </footer>

            <style>{`
        .landing-page {
          padding-top: var(--nav-height);
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* Hero */
        .hero {
          padding: 6rem 0;
          position: relative;
          overflow: hidden;
        }

        .hero .container {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 4rem;
          align-items: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-primary);
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          background: var(--accent-primary);
          border-radius: 50%;
          display: block;
        }

        .hero h1 {
          font-size: clamp(2.5rem, 5vw, 4rem);
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin-bottom: 1.5rem;
        }

        .gradient-text {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-description {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-bottom: 2.5rem;
          max-width: 600px;
        }

        .hero-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 4rem;
        }

        .btn-lg {
          padding: 1rem 2rem;
          font-size: 1.125rem;
        }

        .hero-stats {
          display: flex;
          gap: 3rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .hero-visual {
          display: flex;
          justify-content: center;
        }

        .visual-card {
          width: 100%;
          max-width: 380px;
          padding: 2rem;
          border-radius: 24px;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .accent-icon {
          color: var(--accent-primary);
        }

        .card-header-text h3 {
          margin: 0;
          font-size: 1.125rem;
        }

        .card-header-text span {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .progress-bar {
          height: 12px;
          background: var(--bg-input);
          border-radius: 999px;
          margin-bottom: 2rem;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          width: 75%;
          background: var(--accent-gradient);
          border-radius: 999px;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .status-indicator {
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-weight: 600;
        }

        .status-indicator::before {
          content: "";
          width: 6px;
          height: 6px;
          background: var(--success);
          border-radius: 50%;
        }

        /* Features */
        .features {
          padding: 8rem 0;
          background: rgba(15, 23, 42, 0.3);
        }

        .section-header {
          text-align: center;
          margin-bottom: 5rem;
        }

        .section-header h2 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .section-header p {
          color: var(--text-secondary);
          font-size: 1.125rem;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .feature-card {
          padding: 2.5rem;
          border-radius: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          transition: all 0.3s;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          border-color: var(--accent-primary);
          background: var(--bg-input);
        }

        .feature-icon {
          width: 48px;
          height: 48px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .feature-card h3 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
        }

        .feature-card p {
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* CTA */
        .cta-section {
          padding: 8rem 0;
        }

        .cta-card {
          text-align: center;
          padding: 5rem 2rem;
          border-radius: 32px;
        }

        .cta-card h2 {
          font-size: 3rem;
          margin-bottom: 1.5rem;
        }

        .cta-card p {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-bottom: 3rem;
        }

        /* Footer */
        .landing-footer {
          padding: 4rem 0;
          border-top: 1px solid var(--border-color);
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        @media (max-width: 1024px) {
          .hero .container {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 3rem;
          }
          .hero-content {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hero-description {
            margin-left: auto;
            margin-right: auto;
          }
          .hero-stats {
            justify-content: center;
          }
          .cta-card h2 {
            font-size: 2.5rem;
          }
        }
      `}</style>
        </div>
    );
};

export default LandingPage;
