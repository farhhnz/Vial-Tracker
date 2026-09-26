import React, { useState } from 'react';
import { loginToGoogle } from './services/google/api';
// import EventList from './features/events/EventList';
// import VialTracker from './features/vials/VialTracker';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = () => {
    setLoading(true);
    setErrorMsg('');
    loginToGoogle(
      (token) => {
        setIsAuthenticated(true);
        setLoading(false);
      },
      (error) => {
        setErrorMsg('Gagal terhubung ke akun Google. Silakan coba lagi. (' + error + ')');
        setLoading(false);
      }
    );
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px' }}>
        <h1>Event & Vaccine Tracker</h1>
        <p>Aplikasi dikelola secara privat di Google Workspace Anda.</p>
        <button onClick={handleLogin} disabled={loading} style={{ padding: '10px 20px', fontSize: '16px' }}>
          {loading ? 'Menyiapkan Database...' : 'Login dengan Google'}
        </button>
        {errorMsg && <div style={{ color: 'red', marginTop: '20px', padding: '10px', border: '1px solid red' }}>{errorMsg}</div>}
      </div>
    );
  }

  return (
    <div>
      <nav style={{ padding: '15px', background: '#f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <h2>Dashboard Utama</h2>
        <span style={{ color: 'green' }}>✅ Tersinkronisasi dengan Google</span>
      </nav>
      <div style={{ padding: '20px' }}>
        {/* Render komponen modular Anda di sini */}
        {/* <EventList /> */}
        {/* <VialTracker /> */}
      </div>
    </div>
  );
}
