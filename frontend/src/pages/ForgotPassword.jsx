import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthApi } from '../services/api';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('request'); // request | reset
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const requestReset = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      const r = await AuthApi.forgotPassword(email);
      if (r.reset_token) {
        setResetToken(r.reset_token);
        setInfo(`Reset token: ${r.reset_token}`);
      } else {
        setInfo(r.message || 'If an account exists, a reset email was sent.');
      }
      setStep('reset');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await AuthApi.resetPassword(resetToken, newPassword);
      alert('Password reset. You can now sign in.');
      navigate('/login');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-primary-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">{step === 'request' ? 'Forgot Password' : 'Reset Password'}</h2>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}
          {info && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded text-sm break-all">{info}</div>}
          {step === 'request' ? (
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary w-full" disabled={loading}>{loading ? '...' : 'Send Reset Token'}</button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reset Token</label>
                <input type="text" className="input" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input type="password" className="input" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary w-full" disabled={loading}>{loading ? '...' : 'Reset Password'}</button>
            </form>
          )}
          <div className="mt-4 text-center">
            <a href="/login" className="text-sm text-primary-600">Back to login</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
