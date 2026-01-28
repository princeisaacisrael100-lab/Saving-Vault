import * as React from 'react';

import { Connect } from '@stacks/connect-react';
import { authOptions } from './stacks-config';
import SavingsVault from './SavingsVaultComponent';

function App() {
    const extendedAuthOptions = {
        ...authOptions,
        onFinish: (payload: any) => {
            // The session is already saved by the Connect component, 
            // but we can ensure a clean state by reloading or using state.
            // For now, reload is safest for the library to sync.
            setTimeout(() => window.location.reload(), 100);
        },
    };

    return (
        <Connect authOptions={extendedAuthOptions}>
            <div className="App">
                <SavingsVault />
            </div>
        </Connect>
    );
}


export default App;

