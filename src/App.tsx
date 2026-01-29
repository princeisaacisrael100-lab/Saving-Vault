import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Connect } from '@stacks/connect-react';
import { authOptions, userSession } from './stacks-config';
import SavingsVault from './SavingsVaultComponent';
import LandingPage from './LandingPage';
import Navbar from './Navbar';

function App() {
    const [isSignedIn, setIsSignedIn] = React.useState(userSession.isUserSignedIn());

    React.useEffect(() => {
        const checkAuth = () => {
            setIsSignedIn(userSession.isUserSignedIn());
        };
        checkAuth();
        window.addEventListener('focus', checkAuth);
        return () => window.removeEventListener('focus', checkAuth);
    }, []);

    const extendedAuthOptions = {
        ...authOptions,
        onFinish: (payload: any) => {
            // Updated session state immediately after auth
            setTimeout(() => {
                setIsSignedIn(true);
                window.location.reload();
            }, 100);
        },
    };

    return (
        <Connect authOptions={extendedAuthOptions}>
            <BrowserRouter>
                <div className="App">
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route
                            path="/dashboard"
                            element={
                                isSignedIn ? (
                                    <SavingsVault />
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />
                    </Routes>
                </div>
            </BrowserRouter>
        </Connect>
    );
}

export default App;

